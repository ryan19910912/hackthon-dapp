module pooltogether::validator_adapter{
    use sui_system::{
        sui_system:: {Self, SuiSystemState},
        staking_pool:: {StakedSui},
    };

    use sui::{
        sui::{SUI},
        coin::{Self, Coin},
        dynamic_field as df,
        clock::{Clock},
        balance::{Self,},
        table::{Self, Table},
    };

    use pooltogether::pool::{Self, Pool, GlobalConfig, VALIDATOR};
    use std::type_name::{Self, TypeName};
    use pooltogether::drand_lib::{Self,};
    use pooltogether::staked_share::{Self, StakedPoolShare, NumberPool, ShareSupply};

    const EEmptyStakedSui: u64 = 0;
    const ELuckyNumberAlreadyGen: u64 = 1;

    public struct RestakeReceipt{}

    
    public entry fun stake(
        config: &GlobalConfig,
        share_supply: &mut ShareSupply<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        number_pool: &mut NumberPool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        wrapper: &mut SuiSystemState,
        stake: Coin<SUI>,
        validator: address,
        clock: &Clock,
        ctx: &mut TxContext, 
    ){
        pool.check_arrived_lock_time(clock);
        let amount = coin::value(&stake);
        
        // stake
        let staked_sui = sui_system::request_add_stake_non_entry(wrapper, stake, validator, ctx);
        let active_epoch = staked_sui.stake_activation_epoch();
        
        // update pool balance
        let is_contain_asset = pool.contains_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, StakedSui>();
        
        // update balance record
        if (is_contain_asset){
            let asset_table = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, StakedSui,Table<u64, StakedSui>>();
            
            if (asset_table.contains(active_epoch)){ // epoch existed
                let asset = asset_table.borrow_mut(active_epoch);
                asset.join(staked_sui);
            }else{ // new epoch
                asset_table.add(active_epoch, staked_sui);

                if (df::exists_(pool.uid(), type_name::get<StakedSui>())){ // epoch vector exist
                    let epoch_vec = df::borrow_mut<TypeName, vector<u64>>(pool.uid(), type_name::get<StakedSui>());
                    epoch_vec.push_back(active_epoch);
                }else{ // epoch vector not exist
                    let mut epoch_vec = vector<u64>[];
                    epoch_vec.push_back(active_epoch);
                    df::add(pool.uid(), type_name::get<StakedSui>(), epoch_vec);  
                }
            }
        }else{
            // new epoch table
            let rewards_bag = pool.borrow_mut_rewards<VALIDATOR, Coin<SUI>, Coin<SUI>>();
            let mut epoch_table = table::new<u64, StakedSui>(ctx);
            epoch_table.add(active_epoch, staked_sui);
            rewards_bag.add(type_name::get<StakedSui>(), epoch_table );
            
            // new epoch vector
            let mut epoch_vec = vector<u64>[];
            epoch_vec.push_back(active_epoch);
            df::add(pool.uid(), type_name::get<StakedSui>(), epoch_vec);
        };

        // transfer share to user
        let mut shares: vector<StakedPoolShare<VALIDATOR, Coin<SUI>, Coin<SUI>>> = staked_share::new_share<VALIDATOR, Coin<SUI>, Coin<SUI>>(share_supply, number_pool, amount, ctx);
        
        while(!shares.is_empty()){
            let share = shares.pop_back();
            transfer::public_transfer(share, ctx.sender());
        };
        shares.destroy_empty();
        
    }

    #[allow(unused_assignment)]
    public entry fun withdraw(
        share_supply: &mut ShareSupply<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        number_pool: &mut NumberPool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        share: StakedPoolShare<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        wrapper:  &mut SuiSystemState,
        ctx: &mut TxContext,
    ){
        let amount = share.amount();
        let mut requier_amount = amount;
        
        let is_contain_asset = pool.contains_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, StakedSui>();
        if (is_contain_asset){
            let mut total_sui_balance = balance::zero<SUI>();            
            let mut epoch_vec = vector<u64>[];

            { epoch_vec = copy_epoch(pool) };

            {
                let stakedsui_table = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, StakedSui, Table<u64, StakedSui>>();

                while(epoch_vec.length() > 0){
                    let epoch = epoch_vec.pop_back();
                    let withdraw_staked_sui = stakedsui_table.borrow_mut<u64, StakedSui>(epoch);

                    if (withdraw_staked_sui.staked_sui_amount() > requier_amount){
                        let stakedsui_for_user = withdraw_staked_sui.split(amount, ctx);
                        let withdraw_sui_balance = sui_system::request_withdraw_stake_non_entry(wrapper, stakedsui_for_user, ctx);
                        total_sui_balance.join(withdraw_sui_balance);
                        epoch_vec.push_back(withdraw_staked_sui.stake_activation_epoch());
                        break
                    }else if (withdraw_staked_sui.staked_sui_amount() == requier_amount){
                        let staked_sui = stakedsui_table.remove<u64, StakedSui>(epoch);
                        let withdraw_sui_balance = sui_system::request_withdraw_stake_non_entry(wrapper, staked_sui, ctx);
                        total_sui_balance.join(withdraw_sui_balance);
                        break
                    }else{
                        let staked_sui = stakedsui_table.remove<u64, StakedSui>(epoch);
                        requier_amount = requier_amount - staked_sui.staked_sui_amount();
                        let withdraw_sui_balance = sui_system::request_withdraw_stake_non_entry(wrapper, staked_sui, ctx);   
                        total_sui_balance.join(withdraw_sui_balance);
                    }  
                };


                let mut total_sui = coin::from_balance(total_sui_balance, ctx);
                let total_sui_value = total_sui.value();
                let remain_sui = total_sui.split((total_sui_value - amount), ctx);
                
                transfer::public_transfer(total_sui, ctx.sender());

                // remain SUI to pool
                let is_contain_asset = pool.contains_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, Coin<SUI>>();
                if (is_contain_asset){
                    let asset = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, Coin<SUI>, Coin<SUI>>();
                    asset.join(remain_sui);
                }else{
                    let rewards_mut = pool.borrow_mut_rewards<VALIDATOR, Coin<SUI>, Coin<SUI>>();
                    rewards_mut.add<TypeName, Coin<SUI>>(type_name::get<Coin<SUI>>(), remain_sui);
                };

                // put share to number pool
                number_pool.to_number_pool(share_supply, share);
            };
            {
                df::add<TypeName, vector<u64>>(pool.uid(), type_name::get<StakedSui>(), epoch_vec);
            };

        }else{
            abort (EEmptyStakedSui)
        }

    }

    public entry fun allocate_reward(
        config: &GlobalConfig,
        share_supply: &mut ShareSupply<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        wrapper: &mut SuiSystemState,
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        validator: address,
        drand_round: u64,
        drand_sig: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ){
        assert!(!df::exists_(pool.uid(), pool.current_round()), ELuckyNumberAlreadyGen);
        // check time
        pool.check_arrived_reward_time<VALIDATOR, Coin<SUI>, Coin<SUI>>(clock);

        let (mut total_sui, restake_receipt) = withdraw_all_sui_from_validator(wrapper, pool, ctx);

        
        if (pool.contains_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, Coin<SUI>>()){
            let remain_sui_mut = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, Coin<SUI>, Coin<SUI>>();
            let remain_sui_amount = remain_sui_mut.value();
            let remain_sui = remain_sui_mut.split(remain_sui_amount, ctx);
            total_sui.join(remain_sui);
        };
        
        let restake_sui = total_sui.split(share_supply.active_supply<VALIDATOR, Coin<SUI>, Coin<SUI>>(), ctx);

        // restake to validator
        let total_stakedsui = restake_all_original_sui(wrapper, restake_sui, restake_receipt, validator, ctx);
        
        let mut epoch_vec = vector<u64>[];
        epoch_vec.push_back(total_stakedsui.stake_activation_epoch());
        df::add<TypeName, vector<u64>>(pool.uid(), type_name::get<StakedSui>(), epoch_vec);
        
        let asset_table = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>,StakedSui,  Table<u64, StakedSui>>();
        asset_table.add(total_stakedsui.stake_activation_epoch(), total_stakedsui );
        
        
        // allocate rewards 
        let platform_income_amount = (coin::value(&total_sui)* pool.platform_ratio()) / 10_000;
        let payer_reward_amount = (coin::value(&total_sui)* pool.allocate_gas_payer_ratio()) / 10_000;

        let platform_income = coin::split(&mut total_sui, platform_income_amount, ctx);
        transfer::public_transfer(platform_income, pool::platform_address(config));
        
        let payer_income = coin::split(&mut total_sui, payer_reward_amount, ctx);
        transfer::public_transfer(payer_income, ctx.sender());

        // random select function 
        let lucky_num = drand_lib::random_index_range(drand_round, drand_sig, share_supply.total_supply<VALIDATOR, Coin<SUI>, Coin<SUI>>());

        // add round info
        let current_round = pool.current_round<VALIDATOR, Coin<SUI>, Coin<SUI>>();
        
        df::add<u64, u64>(pool.uid(), current_round, lucky_num);

        // combine prevoius rewards
        let mut round = current_round - 1;
        loop{
            let mut previous_reward_opt = pool.extract_previous_rewards<VALIDATOR, Coin<SUI>, Coin<SUI>>(round);
            if (previous_reward_opt.is_none()){
                previous_reward_opt.destroy_none();
                break
            }else{
                total_sui.join(previous_reward_opt.extract());
                previous_reward_opt.destroy_none();
                round = round - 1;
            };
        };

        pool.put_current_round_reward_to_claimable<VALIDATOR, Coin<SUI>, Coin<SUI>>( total_sui);

        pool.next_round();
        pool.update_time(clock);
        pool.add_expired_data(clock);
    }

    #[allow(lint(self_transfer))]
    public entry fun claim_reward(
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        round: u64,
        mut shares: vector<StakedPoolShare<VALIDATOR, Coin<SUI>, Coin<SUI>>>,
        clock: &Clock,
        ctx: &TxContext,
    ){
        pool.check_claim_expired(round, clock);
        pool.check_is_claimed(round);
        pool.check_round_could_claim_reward<VALIDATOR, Coin<SUI>, Coin<SUI>>(round);

        let lucky_num = *df::borrow<u64, u64>(pool.uid(), round );
        let mut cnt: u64 = 0;
        while(cnt < shares.length()){
            let share = shares.borrow(cnt);
            let start = share.start_num(); 
            let end = share.end_num(); 
            
            if ((lucky_num >= start) && (lucky_num <= end)){
                let reward = pool.extract_round_claimable_reward(round);

                transfer::public_transfer(reward, ctx.sender());
                
                let claimed_table = pool.borrow_mut_claimed();
                claimed_table.add(round, ctx.sender());
                break
                
            }else{
                cnt = cnt + 1u64;
                continue
            }
            
        };
        
        // tmp, need to be remove
        loop{
            let share = shares.pop_back();
            transfer::public_transfer(share, ctx.sender());

            if (vector::is_empty(&shares)){
                shares.destroy_empty();
                break
            };
        };
    }

    #[allow(unused_assignment)]
    fun withdraw_all_sui_from_validator(
        wrapper: &mut SuiSystemState,
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
        ctx: &mut TxContext,
    ): (Coin<SUI>, RestakeReceipt){
        let mut epoch_vec = vector<u64>[];

        { epoch_vec = copy_epoch(pool);};

        let mut total_sui_balance = balance::zero<SUI>();
        let stakedsui_table = pool.borrow_mut_rewards_of_specific_asset<VALIDATOR, Coin<SUI>, Coin<SUI>, StakedSui, Table<u64, StakedSui>>();

        while(epoch_vec.length() > 0){
            let epoch = epoch_vec.pop_back();
            let withdraw_staked_sui = stakedsui_table.remove<u64, StakedSui>(epoch);
            let withdraw_sui_balance = sui_system::request_withdraw_stake_non_entry(wrapper, withdraw_staked_sui, ctx);
            total_sui_balance.join(withdraw_sui_balance);
        };

        let total_sui = coin::from_balance(total_sui_balance, ctx);

        (total_sui, RestakeReceipt{})
    }

    fun restake_all_original_sui(
        wrapper: &mut SuiSystemState,
        restake_sui: Coin<SUI>,
        receipt: RestakeReceipt,
        validator: address,
        ctx: &mut TxContext,
    ): StakedSui{
        let RestakeReceipt{} = receipt;
        let retake_staked_sui = sui_system::request_add_stake_non_entry(wrapper, restake_sui, validator, ctx);
        retake_staked_sui
    }

    fun copy_epoch(
        pool: &mut Pool<VALIDATOR, Coin<SUI>, Coin<SUI>>,
    ):vector<u64>{
        df::remove<TypeName, vector<u64>>(pool.uid(), type_name::get<StakedSui>())
    }

}