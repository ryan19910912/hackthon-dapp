import { TransactionBlock, TransactionArgument } from '@mysten/sui.js/transactions';
import { SuiClient, CoinBalance, SuiObjectDataFilter } from '@mysten/sui.js/client';
import {
  fetchBeaconByTime,
  HttpChainClient,
  HttpCachingChain,
} from 'drand-client'

// 智能合約地址
const PACKAGE_ID: string = `${import.meta.env.VITE_PACKAGE_ID}`;
// 全域設定 Share Object 地址
const GLOBAL_CONFIG_ID: string = `${import.meta.env.VITE_GLOBAL_CONFIG_ID}`;
// OwnerShip 證明 Object 地址
const ADMIN_CAP_ID: string = `${import.meta.env.VITE_ADMIN_CAP_ID}`;

// 質押池 module 名稱
const MODULE_POOL: string = "pool";
// 方法名稱 : 新增質押池
const FUN_NEW_POOL: string = "new_pool";

// 質押紀錄 module 名稱
const MODULE_STAKED_SHARE: string = "staked_share";
// 方法名稱 : 新增並Share
const FUN_NEW_SHARE_NUMBER_POOL: string = "new_and_share_number_pool_and_share_supply";

// 驗證適配器 module 名稱
const MODULE_VALIDATOR_ADAPTER: string = "validator_adapter";
// 方法名稱 : 質押
const FUN_STAKE: string = "stake";
// 方法名稱 : 提取
const FUN_WITHDRAW: string = "withdraw";
// 方法名稱 : 分配獎勵
const FUN_ALLOCATE_REWARDS: string = "allocate_reward";
// 方法名稱 : 領取獎勵
const FUN_CLAIM_REWARD: string = "claim_reward";

// SUI 時間 Share Object 地址
const SUI_CLOCK_ID: string = "0x6";
// SUI System state Share Object 地址
const SUI_SYSTEM_STATE_ID: string = "0x5";
// SUI Coin Type
const SUI_COIN_TYPE: string = "0x2::sui::SUI";
// SUI Coin NATIVE_TYP
const SUI_COIN_NATIVE_TYPE: string = `0x2::coin::Coin<${SUI_COIN_TYPE}>`;
const STAKE_POOL_SHARE_TYPE: string = "StakedPoolShare";
// SUI Coin Decimal
const SUI_COIN_DECIMAL = 1_000_000_000;

enum PoolTypeEnum {
  "Validtor" = "VALIDATOR",
  "Bucket" = "BUCKET_PROTOCOL",
  "Scallop" = "SCALLOP_PROTOCOL"
}

const vaildatorConfig: any = JSON.parse(`${import.meta.env.VITE_VALIDATOR_CONFIG}`);
const bucketConfig: any = JSON.parse(`${import.meta.env.VITE_BUCKET_CONFIG}`);
const scallopConfig: any = JSON.parse(`${import.meta.env.VITE_SCALLOP_CONFIG}`);

const poolTypeConfigMap = new Map<any, any>();
poolTypeConfigMap.set(PoolTypeEnum.Validtor, vaildatorConfig);
poolTypeConfigMap.set(PoolTypeEnum.Bucket, bucketConfig);
poolTypeConfigMap.set(PoolTypeEnum.Scallop, scallopConfig);

const poolAddressConfigMap = new Map<any, any>();
poolAddressConfigMap.set(vaildatorConfig.pool, vaildatorConfig);
poolAddressConfigMap.set(bucketConfig.pool, bucketConfig);
poolAddressConfigMap.set(scallopConfig.pool, scallopConfig);

let filters: SuiObjectDataFilter[] = [];
let poolTypeEnum: any = PoolTypeEnum;
Object.keys(poolTypeEnum).map((key) => {
  let filter: SuiObjectDataFilter = {
    StructType: `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${STAKE_POOL_SHARE_TYPE}
    <${PACKAGE_ID}::${MODULE_POOL}::${poolTypeEnum[key]},
    ${SUI_COIN_NATIVE_TYPE}, ${SUI_COIN_NATIVE_TYPE}>`
  }
  filters.push(filter);
});

const suiClient = new SuiClient({
  url: `${import.meta.env.VITE_SUI_NETWORK_URL}`,
});

// drand 隨機數 config
const chainUrl: string = `${import.meta.env.VITE_DRAND_CHAIN_URL}`;
const chainHash: string = `${import.meta.env.VITE_DRAND_CHAIN_HASH}`;
const publicKey: string = `${import.meta.env.VITE_DRAND_PUBLIC_KEY}`;

const options = {
  disableBeaconVerification: false, // `true` disables checking of signatures on beacons - faster but insecure!!!
  noCache: false, // `true` disables caching when retrieving beacons for some providers
  chainVerificationParams: { chainHash, publicKey }  // these are optional, but recommended! They are compared for parity against the `/info` output of a given node
}

const chain = new HttpCachingChain(`${chainUrl}${chainHash}`, options);
const drandClient = new HttpChainClient(chain, options)

export function getPoolTypeEnum(){
  return PoolTypeEnum;
}

// 構建 新建Pool 交易區塊
export async function packNewPoolTxb(
  poolType: string,
  prepareDuration: number,
  lockStateDuration: number,
  rewardDuration: number,
  platformRatio: number,
  rewardRatio: number,
  allocateGasPayerRatio: number
) {
  let txb: TransactionBlock = new TransactionBlock();

  let typeArgs = [
    `${PACKAGE_ID}::${MODULE_POOL}::${poolType}`,
    SUI_COIN_NATIVE_TYPE,
    SUI_COIN_NATIVE_TYPE
  ];

  let newPoolArgs: TransactionArgument[] = [
    txb.object(GLOBAL_CONFIG_ID),
    txb.object(ADMIN_CAP_ID),
    txb.object(SUI_CLOCK_ID),
    txb.pure(prepareDuration * 1000),
    txb.pure(lockStateDuration * 1000),
    txb.pure(rewardDuration * 1000),
    txb.pure(platformRatio * 100),
    txb.pure(rewardRatio * 100),
    txb.pure(allocateGasPayerRatio * 100)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_POOL}::${FUN_NEW_POOL}`,
    typeArguments: typeArgs,
    arguments: newPoolArgs
  });

  return txb;
}

// 構建 Number pool 交易區塊
export async function packNewNumberPoolTxb(
  poolId: string,
  poolType: string
) {
  let txb: TransactionBlock = new TransactionBlock();

  let typeArgs = [
    `${PACKAGE_ID}::${MODULE_POOL}::${poolType}`,
    SUI_COIN_NATIVE_TYPE,
    SUI_COIN_NATIVE_TYPE
  ];

  let newPoolArgs: TransactionArgument[] = [
    txb.object(ADMIN_CAP_ID),
    txb.object(poolId)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${FUN_NEW_SHARE_NUMBER_POOL}`,
    typeArguments: typeArgs,
    arguments: newPoolArgs
  });

  return txb;
}

// 取得 pool 資訊 列表
export async function getPoolInfoList(address: string) {

  let poolList: Object[] = new Array<Object>();

  if (poolAddressConfigMap.size > 0) {

    for (let poolConfig of poolAddressConfigMap.values()) {

      if (poolConfig.pool === ""){
        continue;
      }

      let poolObjectResp = await suiClient.getObject({
        id: poolConfig.pool,
        options: {
          showContent: true
        }
      });
      if (poolObjectResp.data?.content) {

        let poolObject: any = new Object();

        let poolData: any = poolObjectResp.data.content;

        console.log(poolData);

        poolObject.poolId = poolData.fields.id.id;
        poolObject.poolType = poolData.type.split(",")[0].split("::")[4];

        // 獎勵分配設定
        let rewardAllocate: any = new Object();
        rewardAllocate.allocateGasPayerRatio = (parseFloat(poolData.fields.reward_allocate.fields.allocate_gas_payer_ratio)/100).toFixed(2);
        rewardAllocate.allocateUserAmount = poolData.fields.reward_allocate.fields.allocate_user_amount
        rewardAllocate.platformRatio = (parseFloat(poolData.fields.reward_allocate.fields.platform_ratio)/100).toFixed(2);
        rewardAllocate.rewardRatio = (parseFloat(poolData.fields.reward_allocate.fields.reward_ratio)/100).toFixed(2);
        poolObject.rewardAllocate = rewardAllocate;

        // 時間設定
        let timeInfo: any = new Object();
        timeInfo.rewardDuration = poolData.fields.time_info.fields.reward_duration;
        timeInfo.startTime = poolData.fields.time_info.fields.start_time;

        let startDate = new Date();
        startDate.setTime(timeInfo.startTime);
        timeInfo.startTimeFormat = startDate.toLocaleString();

        let rewardDate = new Date();
        rewardDate.setTime(Number(timeInfo.startTime) + Number(timeInfo.rewardDuration));
        timeInfo.rewardTimeFormat = rewardDate.toLocaleString();

        poolObject.canAllocateReward = new Date().getTime() > rewardDate.getTime();
        poolObject.canStake = new Date().getTime() > startDate.getTime();
        poolObject.needNewNumberPool = poolConfig.numberPool === "";

        poolObject.timeInfo = timeInfo;
        if (poolConfig.shareSupply !== ""){
          poolObject.shareSupplyInfo = await getShareSupply(poolConfig.shareSupply);
        }

        // 已領取獎勵的Map<round, address>
        let claimedMap = await getTableData(poolData.fields.claimed.fields.id.id);
        poolObject.claimedMap = claimedMap;

        // 存放可以領獎的得獎者 陣列 
        // {poolId, round, luckNum}
        let canClaimRoundWinnerList: any = [];
        poolObject.canClaimRoundWinnerList = canClaimRoundWinnerList;

        let dynamicFieldsResp = await suiClient.getDynamicFields({
          parentId: poolConfig.pool,
        });

        if (dynamicFieldsResp.data){
          let array = dynamicFieldsResp.data;
          for (let dynamicFields of array){
            if (dynamicFields.objectType === "u64"){
              let winnerObjResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (winnerObjResp.data?.content){
                let dataContent: any = winnerObjResp.data.content;
                let round = dataContent.fields.name;
                if (claimedMap && claimedMap.has(round)){
                  continue;
                }
                canClaimRoundWinnerList.push(
                  {
                    poolId : poolObject.poolId,
                    round : round,
                    luckNum : dataContent.fields.value
                  }
                );
              }
            }
          }
        }
        poolList.push(poolObject);
      }
    }
  }

  return poolList;
}

// 取得 供應 資訊
async function getShareSupply(shareSupplyId: string) {
  let objectResponse = await suiClient.getObject({
    id: shareSupplyId,
    options: {
      showContent: true
    }
  });
  let obj: any = new Object();
  if (objectResponse.data?.content) {
    let data: any = objectResponse.data.content;
    obj.totalSupply = data.fields.total_supply;
    obj.activeSupply = data.fields.active_supply;
  }
  return obj;
}

// 取得 用戶質押資訊 列表
export async function getUserStakeInfoList(address: string, canClaimRoundWinnerList: any[]){
  let usrStakeInfoList: any[] = [];

  let objectResponse: any = await suiClient.getOwnedObjects({
    owner: address,
    options: {
      showContent: true
    },
    filter: {
      MatchAny: filters
    }
  });

  if (objectResponse.data) {
    objectResponse.data.forEach((resp: any) => {
      let usrStakeInfo: any = new Object();
      usrStakeInfo.id = resp.data.content.fields.id.id;
      let startNum = resp.data.content.fields.start_num;
      let endNum = resp.data.content.fields.end_num;
      let winnerInfoList: any[] = [];
      usrStakeInfo.winnerInfoList = winnerInfoList;
      for (let winnerInfo of canClaimRoundWinnerList){
        let luckNum = winnerInfo.luckNum;
        if (luckNum >= startNum && luckNum <= endNum){
          winnerInfoList.push(winnerInfo);
        }
      }
      usrStakeInfo.startNum = startNum;
      usrStakeInfo.endNum = endNum;
      usrStakeInfo.suiAmount = (Number(endNum) - Number(startNum) + 1) / SUI_COIN_DECIMAL;
      usrStakeInfo.poolType = resp.data.content.type.split(",")[0].split("::")[4];
      usrStakeInfoList.push(usrStakeInfo);
    });
  }

  return usrStakeInfoList;
}

// 取得 Table 內的資料
async function getTableData(fieldId: string) {
  let tableDataResp = await suiClient.getDynamicFields({
    parentId: fieldId
  });
  let tableMap = new Map();
  if (tableDataResp.data) {
    for (let i = 0; i < tableDataResp.data.length; i += 1) {
      let obj = tableDataResp.data[i];
      let type = obj.name.type;
      let value = obj.name.value;

      await getTableRawData(fieldId, type, value).then(rep => {
        for (let [key, value] of rep) {
          tableMap.set(key, value);
        }
      });
    }
  }
  return tableMap;
}

// 取得 Table 內的原始資料
async function getTableRawData(fieldId: string, type: string, value: unknown) {
  let response = await suiClient.getDynamicFieldObject({
    parentId: fieldId,
    name: {
      type: type,
      value: value
    }
  })

  const tableMap = new Map();
  if (response.data) {
    let content: any = response.data.content;
    let map_key = content.fields.name;
    let map_value = content.fields.value;
    tableMap.set(map_key, map_value);
  }

  return tableMap;
}

// 建構 Stake 的交易區塊
export async function packStakeTxb(
  address: string,
  poolId: string,
  stakeAmount: number
) {

  let poolConfig = poolAddressConfigMap.get(poolId);

  let txb: TransactionBlock = new TransactionBlock();

  let coinBalance: CoinBalance = await suiClient.getBalance({
    owner: address,
    coinType: SUI_COIN_TYPE
  });

  let stakeCoinAmount: number = Number((stakeAmount * SUI_COIN_DECIMAL));

  if (Number(coinBalance.totalBalance) < stakeCoinAmount) {
    alert("Not Enough Balance.");
  }

  const [coins] = txb.splitCoins(txb.gas, [txb.pure(stakeCoinAmount)]);

  let args: TransactionArgument[] = [
    txb.object(GLOBAL_CONFIG_ID),
    txb.object(poolConfig.shareSupply),
    txb.object(poolAddressConfigMap.get(poolId).numberPool),
    txb.object(poolId),
    txb.object(SUI_SYSTEM_STATE_ID),
    coins,
    txb.pure.address(poolConfig.validator),
    txb.object(SUI_CLOCK_ID)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_STAKE}`,
    arguments: args
  });

  return txb;
}

// 建構 withdraw 的交易區塊
export async function packWithdrawTxb(
  poolType: string,
  stakePoolShareId: string
) {

  let txb: TransactionBlock = new TransactionBlock();

  let poolConfig = poolTypeConfigMap.get(poolType);

  let args: TransactionArgument[] = [
    txb.object(poolConfig.shareSupply),
    txb.object(poolConfig.numberPool),
    txb.object(poolConfig.pool),
    txb.object(stakePoolShareId),
    txb.object(SUI_SYSTEM_STATE_ID)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_WITHDRAW}`,
    arguments: args
  });

  return txb;
}

// 建構 分配獎勵 的交易區塊
export async function packAllocateRewardsTxb(
  poolId: string
) {

  let poolType = poolAddressConfigMap.get(poolId);

  let txb: TransactionBlock = new TransactionBlock();

  // const theLatestBeacon = await fetchBeacon(drandClient)
  const theLatestBeacon = await fetchBeaconByTime(drandClient, Date.now())

  const drand_round: number = theLatestBeacon.round;
  const byteArray = hex16String2Vector(theLatestBeacon.signature);

  let args: TransactionArgument[] = [
    txb.object(GLOBAL_CONFIG_ID),
    txb.object(poolType.shareSupply),
    txb.object(SUI_SYSTEM_STATE_ID),
    txb.object(poolId),
    txb.pure.address(poolType.validator),
    txb.pure.u64(drand_round),
    txb.pure(byteArray),
    txb.object(SUI_CLOCK_ID)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_ALLOCATE_REWARDS}`,
    arguments: args
  });

  return txb;
}

// 建構 領取獎勵 的交易區塊
export async function packClaimRewardTxb(
  stakedShareId: string,
  winnerInfoList: any[]
) {

  let txb: TransactionBlock = new TransactionBlock();

  for (let winnerInfo of winnerInfoList){
    let args: TransactionArgument[] = [
      txb.object(winnerInfo.poolId),
      txb.pure.u64(winnerInfo.round),
      txb.pure([txb.object(stakedShareId)]),
    ];
  
    txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_CLAIM_REWARD}`,
      arguments: args
    });
  }

  return txb;
}

function hex16String2Vector(str: string) {
  // 定義一個空數組來存儲結果
  let byteArray = [];

  // 將十六進制字符串每兩個字符分割並將其轉換為十進制數字，然後添加到數組中
  for (let i = 0; i < str.length; i += 2) {
    byteArray.push(parseInt(str.slice(i, i + 2), 16));
  }

  return byteArray;
}