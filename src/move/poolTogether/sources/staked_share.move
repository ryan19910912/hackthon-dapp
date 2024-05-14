module pooltogether::staked_share{

    use pooltogether::pool::{Pool, AdminCap};

    const ENumberCannotCombine: u64 = 0;

    public struct NumberPool<phantom PoolType, phantom NativeType: store + key, RewardType: store + key> has key{
        id: UID,
        available_shares: vector<StakedPoolShare<PoolType, NativeType, RewardType>>,
    }
    
    public struct StakedPoolShare<phantom PoolType, phantom NativeType, phantom RewardType> has key, store{
        id: UID, 
        start_num: u64,
        end_num: u64,
    }

    public struct ShareSupply<phantom PoolType, phantom NativeType, phantom RewardType> has key{
        id: UID,
        active_supply: u64,
        total_supply: u64,
    }

    public entry fun new_and_share_number_pool_and_share_supply<PoolType: store, NativeType: store + key, RewardType: store + key>(
        _: &AdminCap,
        pool: &mut Pool<PoolType, NativeType, RewardType>,
        ctx: &mut TxContext,
    ){
        let number_pool = NumberPool<PoolType, NativeType, RewardType>{
            id: object::new(ctx),
            available_shares: vector<StakedPoolShare<PoolType, NativeType, RewardType>>[],
        };

        transfer::share_object(number_pool);

        let share_supply = ShareSupply<PoolType, NativeType, RewardType>{
            id: object::new(ctx),
            active_supply: 0u64,
            total_supply: 0u64,
            
        };
        transfer::share_object(share_supply);
    }

    public(package) fun new_share<PoolType, NativeType: store + key, RewardType: store + key>(
        share_supply: &mut ShareSupply<PoolType, NativeType, RewardType>,
        number_pool: &mut NumberPool<PoolType, NativeType, RewardType>,
        amount: u64, 
        ctx: &mut TxContext,
    ): vector<StakedPoolShare<PoolType, NativeType, RewardType>>{
        let mut require_amount = amount;
        if (number_pool.available_shares.length() == 0){

            share_supply.total_supply = share_supply.total_supply + require_amount;
            share_supply.active_supply = share_supply.active_supply + require_amount;

            vector<StakedPoolShare<PoolType, NativeType, RewardType>>[
                StakedPoolShare<PoolType, NativeType, RewardType>{
                    id: object::new(ctx), 
                    start_num: (share_supply.total_supply - require_amount + 1),
                    end_num: (share_supply.total_supply), 
                }
            ]
        }else{
            let mut shares = vector<StakedPoolShare<PoolType, NativeType, RewardType>>[];
            while(number_pool.available_shares.length() != 0){
                let mut available_share = number_pool.available_shares.pop_back();
                let share_amount = available_share.end_num - available_share.start_num + 1;
                if (share_amount > require_amount){
                    let share_to_user = available_share.split(require_amount, ctx);
                    shares.push_back(share_to_user);
                    number_pool.available_shares.push_back(available_share);
                    share_supply.active_supply = share_supply.active_supply + require_amount;
                    require_amount = 0;  
                    break
                }else if (share_amount == require_amount){
                    shares.push_back(available_share);
                    share_supply.active_supply = share_supply.active_supply + require_amount;
                    require_amount = 0;
                    break
                }else{
                    shares.push_back(available_share);
                    share_supply.active_supply = share_supply.active_supply + share_amount;
                    require_amount = require_amount - share_amount;
                }
            };

            if (require_amount != 0){
                share_supply.total_supply = share_supply.total_supply + require_amount;
                share_supply.active_supply = share_supply.active_supply + require_amount;
                
                shares.push_back(
                    StakedPoolShare<PoolType, NativeType, RewardType>{
                        id: object::new(ctx), 
                        start_num: (share_supply.total_supply- require_amount + 1),
                        end_num: (share_supply.total_supply), 
                    }
                );
            };

            shares
        }
    }

    public fun split<PoolType, NativeType, RewardType>(
        base_share: &mut StakedPoolShare<PoolType, NativeType, RewardType>,
        amount: u64,
        ctx: &mut TxContext,
    ): StakedPoolShare<PoolType, NativeType, RewardType>{
        let new_share = StakedPoolShare<PoolType, NativeType, RewardType>{
            id: object::new(ctx),
            start_num: (base_share.start_num + amount),
            end_num: base_share.end_num,
        };

        base_share.end_num = base_share.end_num - amount;

        new_share
    }

    public fun merge<PoolType, NativeType, RewardType>(
        base_share: &mut StakedPoolShare<PoolType, NativeType, RewardType>,
        merging_share: StakedPoolShare<PoolType, NativeType, RewardType>,
    ){
        assert!(
            (base_share.start_num  == merging_share.end_num + 1) ||
            (base_share.end_num + 1 == merging_share.start_num),
            ENumberCannotCombine
        );

        let StakedPoolShare<PoolType, NativeType, RewardType>{
            id,
            start_num,
            end_num,
        } =  merging_share;


        if (base_share.start_num  == end_num + 1){
            base_share.start_num = start_num;
        }else{
            base_share.end_num = end_num;
        };

        object::delete(id);

    }

    public fun amount<PoolType, NativeType, RewardType>(
        share: &StakedPoolShare<PoolType, NativeType, RewardType>,
    ): u64{
          share.end_num - share.start_num + 1u64
    }

    public(package) fun to_number_pool<PoolType, NativeType: store + key, RewardType: key + store>(
        number_pool: &mut NumberPool<PoolType, NativeType, RewardType>,
        share_supply: &mut ShareSupply<PoolType, NativeType, RewardType>,
        share: StakedPoolShare<PoolType, NativeType, RewardType>,
    ){
        
        share_supply.active_supply = share_supply.active_supply - (share.end_num - share.start_num + 1);
        number_pool.available_shares.push_back(share);
    }

    public fun start_num<PoolType, NativeType: store + key, RewardType: store + key>(
        share: &StakedPoolShare<PoolType, NativeType, RewardType>,
    ): u64{
        share.start_num
    }

    public fun end_num<PoolType, NativeType: store + key, RewardType: key + store>(
        share: &StakedPoolShare<PoolType, NativeType, RewardType>,
    ): u64{
        share.end_num
    }

    public fun total_supply<PoolType, NativeType: store + key, RewardType>(
        share_supply: &ShareSupply<PoolType, NativeType, RewardType>,
    ): u64{
        share_supply.total_supply
    }

    public fun active_supply<PoolType, NativeType: store + key, RewardType: store + key>(
        share_supply: &ShareSupply<PoolType, NativeType, RewardType>,
    ):u64{
         share_supply.active_supply
    }

}