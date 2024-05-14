module pooltogether::pool{
    
    use sui::{
        table::{Self, Table},
        clock::{Self, Clock},
        dynamic_object_field as dof,
        dynamic_field as df,
        bag::{Self, Bag},
    };

    use std::{
        type_name::{Self, TypeName},
        string::{Self, String},
        option::{Self, Option},
    };


    const VERSION: u64 = 1;


    const EVersionNotMatched: u64 = 0;
    const EOverAllocateMax: u64 = 1;
    const EPoolNotFound: u64 = 2;
    const ENotExpiredYet: u64 = 3;
    const EPoolDuplicated: u64 = 4;
    const ERewardsNotFound: u64 = 5;
    const EAlreadyClaimed: u64 = 6;
    const ERoundError: u64 = 7;
    const ENumberPoolAlreadySet: u64 = 8;
    const ESettlingNow: u64 = 9;
    const EWrongTimeSetting:u64 = 10;
    const EClaimPhaseExpired: u64 = 11;
    const EWrongRound: u64 = 12;

    public struct VALIDATOR has store, copy, drop{}
    public struct BUCKET_PROTOCOL has store, copy, drop{}
    public struct SCALLOP_PROTOCOL has store, copy, drop{}

    
    
    public struct GlobalConfig has key {
        id : UID,
        version: u64, 
        platform: address,
    }

    public struct TimeInfo has store{
        start_time: u64,
        lock_stake_duration: u64,
        reward_duration: u64,
        expire_duration: u64,
    }


    public struct RewardAllocate has store{
        allocate_user_amount: u64,
        platform_ratio: u64,
        reward_ratio: u64,
        allocate_gas_payer_ratio: u64,
    }

    public struct Pool< phantom PoolType, phantom NativeType: store + key, phantom RewardType: store + key> has key {
        id: UID,
        current_round: u64,
        time_info: TimeInfo,
        reward_allocate: RewardAllocate,
        rewards: Bag,
        claimable: Table<u64, RewardType>,
        claimed: Table<u64, address>,
    }

    public struct AdminCap has key{
        id: UID,
    }

    public struct StakedValidatorKey has store, copy, drop {}
    public struct RestakeReceipt {}

    public struct ClaimExpiredTime has store, copy, drop{}

    

    fun init (ctx: &mut TxContext){
        let adminCap = AdminCap{
            id: object::new(ctx),
        };

        let config = GlobalConfig{
            id: object::new(ctx),
            version: VERSION,
            platform: ctx.sender(),
            // dynamic object field TypeName -> Table<TypeName, ID> 1. pooltype 2. coinType
        };

        transfer::transfer(adminCap, ctx.sender());
        transfer::share_object(config);
    }

    // @dev create pool by admin
    #[allow(lint(share_owned))]
    public entry fun new_pool<PoolType: store + copy + drop, NativeType: store + key, RewardType: store + key> (
        config: &mut GlobalConfig,
        _: &AdminCap,
        clock: &Clock,
        prepare_duration: u64,
        lock_stake_duration: u64,
        reward_duration: u64,
        expire_duration: u64,
        platform_ratio: u64,
        reward_ratio: u64,
        allocate_gas_payer_ratio: u64,
        ctx: &mut TxContext,
    ){
        assert!(config.version == VERSION, EVersionNotMatched);
        
        check_duplicated<PoolType, NativeType, RewardType>(config);

        // create new pool
        let mut pool = create_pool<PoolType, NativeType, RewardType>(clock, prepare_duration,lock_stake_duration, reward_duration, expire_duration, platform_ratio, reward_ratio, allocate_gas_payer_ratio, ctx);

        // update type table
        if (dof::exists_(&config.id, type_name::get<PoolType>()) ){
            let type_table = dof::borrow_mut<TypeName, Table<TypeName, ID>>(&mut config.id, type_name::get<PoolType>());
            type_table.add<TypeName, ID>(type_name::get<NativeType>(), pool.id.uid_to_inner());
        }else{
            let mut type_table = table::new<TypeName, ID>(ctx);
            type_table.add<TypeName, ID>(type_name::get<NativeType>(), pool.id.uid_to_inner());
            dof::add<TypeName, Table<TypeName, ID>>(&mut pool.id, type_name::get<PoolType>(), type_table);
        };

        // record the pool type 
        record_pool<PoolType, NativeType, RewardType>(config, pool.id.uid_to_inner(), ctx);

        let mut expire_table = table::new<u64, u64>(ctx);
        expire_table.add(pool.current_round, (pool.time_info.start_time + expire_duration));
        dof::add(&mut pool.id, ClaimExpiredTime{}, expire_table);

        // pool to shared object
        transfer::share_object(pool)
    }

    public fun create_pool<PoolType: store + copy + drop, NativeType: store + key, RewardType: store + key>(
        clock: &Clock,
        prepare_duration: u64,
        lock_stake_duration: u64,
        reward_duration: u64,
        expire_duration: u64,
        platform_ratio: u64,
        reward_ratio: u64,
        allocate_gas_payer_ratio: u64,
        ctx: &mut TxContext,
    ): Pool<PoolType, NativeType, RewardType>{

        assert!((platform_ratio+ reward_ratio+ allocate_gas_payer_ratio) == 10_000, EOverAllocateMax);
        assert!(lock_stake_duration <=reward_duration, EWrongTimeSetting);
            
        Pool<PoolType, NativeType, RewardType>{
            id: object::new(ctx),
            current_round: 1,
            time_info: TimeInfo{ start_time: (clock::timestamp_ms(clock) + prepare_duration), reward_duration, lock_stake_duration, expire_duration,},
            reward_allocate: RewardAllocate{allocate_user_amount: 1, platform_ratio, reward_ratio, allocate_gas_payer_ratio,},
            rewards: bag::new(ctx),
            claimable: table::new(ctx),
            claimed: table::new(ctx),
        }
    }

    public(package) fun borrow_mut_rewards<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
    ): &mut Bag{
        &mut pool.rewards
    }

    public(package) fun put_current_round_reward_to_claimable<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        reward: RewardType,
    ){
        pool.claimable.add(pool.current_round, reward);
    }

    public(package) fun extract_round_claimable_reward<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ): RewardType{
        let reward = pool.claimable.remove(round);
        reward
    }

    public(package) fun check_round_reward_exist<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ) {
        assert!(pool.claimable.contains(round), ERewardsNotFound)
    }

    public(package) fun borrow_mut_claimed<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>
    ): &mut Table<u64, address>{
        &mut pool.claimed
    }

    public(package) fun check_is_claimed<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ){
        assert!(!pool.claimed.contains(round), EAlreadyClaimed);
    }


    public(package) fun uid <PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
    ): &mut UID{
        &mut pool.id
    }

    public(package) fun next_round <PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>
    ){
        pool.current_round = pool.current_round + 1;
    }

    public fun check_arrived_reward_time<PoolType, AssetType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, AssetType, RewardType>,
        clock: &Clock,
    ){
        assert!((pool.time_info.start_time + pool.time_info.reward_duration) <= clock::timestamp_ms(clock), ENotExpiredYet);
    }

    public fun check_arrived_lock_time<PoolType, AssetType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, AssetType, RewardType>,
        clock: &Clock,
    ){
        assert!((pool.time_info.start_time + pool.time_info.lock_stake_duration) <= clock::timestamp_ms(clock), ESettlingNow);
    }

    public fun check_round_could_claim_reward<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ){
        assert!(pool.current_round > round, ERoundError);
    }

    public(package) fun check_claim_expired <PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
        round: u64,
        clock: &Clock,
    ){
        let expire_table = dof::borrow<ClaimExpiredTime, Table<u64, u64>>(&pool.id, ClaimExpiredTime{});
        let expire_time  = *expire_table.borrow(round);
        assert!(expire_time <= clock::timestamp_ms(clock), EClaimPhaseExpired);
    }

    public(package) fun add_expired_data<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        clock: &Clock,
    ){
        let expire_table = dof::borrow_mut<ClaimExpiredTime, Table<u64, u64>>(&mut pool.id, ClaimExpiredTime{});
        expire_table.add(pool.current_round, pool.time_info.start_time + pool.time_info.expire_duration);
    }

    public(package) fun is_claimed<PoolType, NativeType: store + key, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ): bool{
        pool.claimed.contains(round)
    }


    public fun platform_ratio<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
    ): u64{
        pool.reward_allocate.platform_ratio
    }

    public fun allocate_gas_payer_ratio<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
    ): u64{
       pool.reward_allocate.allocate_gas_payer_ratio
    }

    public fun reward_ratio<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
    ): u64{
        pool.reward_allocate.reward_ratio
    }

    public fun platform_address(
        config: &GlobalConfig,
    ): address{
        config.platform
    }

    public fun current_round<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &Pool<PoolType, NativeType, RewardType>,
    ): u64{
        pool.current_round
    }

    public(package) fun borrow_mut_rewards_of_specific_asset<PoolType, NativeType: key + store, RewardType: store + key, KeyType, AssetType: store>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
    ): &mut AssetType{
        pool.rewards.borrow_mut<TypeName, AssetType>(type_name::get<KeyType>())
    }

    public(package) fun extract_rewards_of_specific_asset<PoolType, NativeType: key + store, RewardType: store + key, AssetType: key + store>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
    ): AssetType{
        pool.rewards.remove<TypeName, AssetType>(type_name::get<AssetType>())
    }

    public(package) fun contains_asset<PoolType, NativeType: key + store, RewardType: store + key, AssetType: key + store>(
        pool: &Pool<PoolType, NativeType, RewardType>,
    ): bool{
        if(pool.rewards.contains(type_name::get<AssetType>())){
            true
        }else{
            false
        }
    }

    public(package) fun update_time<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        clock: &Clock,
    ){
        pool.time_info.start_time = clock::timestamp_ms(clock);
    }

    fun check_duplicated<PoolType, NativeType, RewardType>(
        config: &GlobalConfig,
    ){
        let native_type_vec8 = type_name::get<NativeType>().into_string();
        let reward_type_vec8 = type_name::get<RewardType>().into_string();
        let mut pool_detail_type = string::from_ascii(native_type_vec8);
        pool_detail_type.append(string::from_ascii(reward_type_vec8));
        
        if (dof::exists_(&config.id, type_name::get<PoolType>()) ){
            let type_table = dof::borrow<TypeName, Table<String, ID>>(&config.id, type_name::get<PoolType>());
            if (type_table.contains(pool_detail_type)){
                abort (EPoolDuplicated)
            }
        }
    }

    fun record_pool<PoolType, NativeType, RewardType>(
        config: &mut GlobalConfig,
        pool_id: ID,
        ctx: &mut TxContext,
    ){
        let native_type_vec8 = type_name::get<NativeType>().into_string();
        let reward_type_vec8 = type_name::get<RewardType>().into_string();
        let mut pool_detail_type = string::from_ascii(native_type_vec8);
        pool_detail_type.append(string::from_ascii(reward_type_vec8));


        if (dof::exists_(&config.id, type_name::get<PoolType>()) ){
            let type_table = df::borrow_mut<TypeName, Table<String, ID>>(&mut config.id, type_name::get<PoolType>());
            type_table.add(pool_detail_type, pool_id);
        }else{
            let mut type_table = table::new<String, ID>(ctx);
            type_table.add(pool_detail_type, pool_id);
            dof::add(&mut config.id, type_name::get<PoolType>(), type_table);
        }

        
    }

    public(package) fun extract_previous_rewards<PoolType, NativeType: key + store, RewardType: store + key>(
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        round: u64,
    ): Option<RewardType>{
        assert!(round < pool.current_round, EWrongRound);
        
        if (pool.claimable.contains(round)){
            option::some<RewardType>(extract_round_claimable_reward<PoolType, NativeType, RewardType>(pool, round))
        }else{
            option::none<RewardType>()
        }
        
    }
}

// bag (tn)--> table<u64, StakedSui>
// df (tn) -->  list epoch
// bag (tn) -> Coin<T>
