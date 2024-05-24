import { TransactionBlock, TransactionArgument } from '@mysten/sui.js/transactions';
import { SuiClient, SuiObjectDataFilter } from '@mysten/sui.js/client';
import {
  fetchBeaconByTime,
  HttpChainClient,
  HttpCachingChain,
} from 'drand-client'

enum PoolTypeEnum {
  VALIDATOR = "VALIDATOR",
  BUCKET_PROTOCOL = "BUCKET_PROTOCOL",
  SCALLOP_PROTOCOL = "SCALLOP_PROTOCOL"
}

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
const MODULE_BUCKET_ADAPTER: string = "bucket_adapter";
const MODULE_SCALLOP_ADAPTER: string = "scallop_adapter"
// 方法名稱 : 質押
const FUN_STAKE: string = "stake";
// 方法名稱 : 提取
const FUN_WITHDRAW: string = "withdraw";
// 方法名稱 : 分配獎勵
const FUN_ALLOCATE_REWARDS: string = "allocate_reward";
// 方法名稱 : 領取獎勵
const FUN_CLAIM_REWARD: string = "claim_reward";
// 方法名稱 : 切割 share
const FUN_SPLIT_SHARE: string = "split";

const vaildatorConfig: any = JSON.parse(`${import.meta.env.VITE_VALIDATOR_CONFIG}`);
const bucketConfig: any = JSON.parse(`${import.meta.env.VITE_BUCKET_CONFIG}`);
const scallopConfig: any = JSON.parse(`${import.meta.env.VITE_SCALLOP_CONFIG}`);

const poolTypeConfigMap: any = new Map<any, any>();
poolTypeConfigMap.set(vaildatorConfig.poolType, vaildatorConfig);
poolTypeConfigMap.set(bucketConfig.poolType, bucketConfig);
poolTypeConfigMap.set(scallopConfig.poolType, scallopConfig);

const poolAddressConfigMap: any = new Map<any, any>();
poolAddressConfigMap.set(vaildatorConfig.pool, vaildatorConfig);
poolAddressConfigMap.set(bucketConfig.pool, bucketConfig);
poolAddressConfigMap.set(scallopConfig.pool, scallopConfig);

// SUI 時間 Share Object 地址
const SUI_CLOCK_ID: string = "0x6";
// SUI System state Share Object 地址
const SUI_SYSTEM_STATE_ID: string = "0x5";

const SUI_COIN_TYPE: string = "0x2::sui::SUI";
const BUCK_COIN_TYPE: string = `${import.meta.env.VITE_BUCK_COIN_TYPE}`;
const SBUCK_COIN_TYPE: string = `${import.meta.env.VITE_SBUCK_COIN_TYPE}`;
const SCA_COIN_TYPE: string = `${import.meta.env.VITE_SCA_COIN_TYPE}`;

// Bucket 所需要的參數
const BUCKET_FLASK: string = `${import.meta.env.VITE_BUCKET_FLASK}`;
const BUCKET_FOUTAIN: string = `${import.meta.env.VITE_BUCKET_FOUTAIN}`;
const BUCKET_LOCK_TIME: number = Number(`${import.meta.env.VITE_BUCKET_LOCK_TIME}`);

// Scallop 所需的參數
const SCALLOP_VERSION: string = `${import.meta.env.VITE_SCALLOP_VERSION}`;
const SCALLOP_MARKET: string = `${import.meta.env.VITE_SCALLOP_MARKET}`;

// SUI Coin NATIVE_TYP
const COIN_TYPE: string = `0x2::coin::Coin`;
const STAKE_POOL_SHARE_TYPE: string = "StakedPoolShare";
// SUI Coin Decimal
const SUI_COIN_DECIMAL = 1_000_000_000;
const BUCK_COIN_DECIMAL = 1_000_000_000;
const SCA_COIN_DECIMAL = 1_000_000_000;

const poolTypeCommonTypeMap: any = new Map();
let filterMap: Map<any, any> = new Map();
let filters: any[] = [];
Array.from(poolTypeConfigMap.keys()).map((poolType: any) => {
  let nativeType: string = `${COIN_TYPE}<${SUI_COIN_TYPE}>`;
  let rewardType: string = `${COIN_TYPE}<${SUI_COIN_TYPE}>`;
  let decimal: number = SUI_COIN_DECIMAL;
  let coinType: string = SUI_COIN_TYPE;
  let coinName: string = "SUI";
  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:
      break;
    case PoolTypeEnum.BUCKET_PROTOCOL:
      nativeType = `${COIN_TYPE}<${BUCK_COIN_TYPE}>`;
      decimal = BUCK_COIN_DECIMAL;
      coinType = BUCK_COIN_TYPE;
      coinName = "BUCK";
      break;
    case PoolTypeEnum.SCALLOP_PROTOCOL:
      nativeType = `${COIN_TYPE}<${SCA_COIN_TYPE}>`;
      rewardType = `${COIN_TYPE}<${SCA_COIN_TYPE}>`;
      decimal = SCA_COIN_DECIMAL;
      coinType = SCA_COIN_TYPE;
      coinName = "SCA";
      break;
  }
  let structType = `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${STAKE_POOL_SHARE_TYPE}
    <${PACKAGE_ID}::${MODULE_POOL}::${poolType},${nativeType}, ${rewardType}>`;
  let filter: SuiObjectDataFilter = {
    StructType: structType
  }
  filterMap.set(poolType, filter);
  filters.push(filter);
  poolTypeCommonTypeMap.set(poolType, {
    nativeType: nativeType,
    rewardType: rewardType,
    decimal: decimal,
    coinType: coinType,
    coinName: coinName
  });
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

export function getPoolTypeList() {
  return Array.from(poolTypeConfigMap.keys());
}

// 構建 新建Pool 交易區塊
export async function packNewPoolTxb(
  poolType: string,
  prepareDuration: number,
  lockStateDuration: number,
  rewardDuration: number,
  expireDuration: number,
  platformRatio: number,
  rewardRatio: number,
  allocateGasPayerRatio: number
) {
  let txb: TransactionBlock = new TransactionBlock();

  let nativeType: string = poolTypeCommonTypeMap.get(poolType).nativeType;
  let rewardType: string = poolTypeCommonTypeMap.get(poolType).rewardType;

  let typeArgs = [
    `${PACKAGE_ID}::${MODULE_POOL}::${poolType}`,
    nativeType, rewardType
  ];

  let newPoolArgs: TransactionArgument[] = [
    txb.object(GLOBAL_CONFIG_ID),
    txb.object(ADMIN_CAP_ID),
    txb.object(SUI_CLOCK_ID),
    txb.pure(prepareDuration * 1000),
    txb.pure(lockStateDuration * 1000),
    txb.pure(rewardDuration * 1000),
    txb.pure(expireDuration * 1000),
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
  poolType: string
) {
  let txb: TransactionBlock = new TransactionBlock();

  let nativeType: string = poolTypeCommonTypeMap.get(poolType).nativeType;
  let rewardType: string = poolTypeCommonTypeMap.get(poolType).rewardType;

  let typeArgs = [
    `${PACKAGE_ID}::${MODULE_POOL}::${poolType}`,
    nativeType,
    rewardType
  ];

  let newPoolArgs: TransactionArgument[] = [
    txb.object(ADMIN_CAP_ID)
  ];

  txb.moveCall({
    target: `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${FUN_NEW_SHARE_NUMBER_POOL}`,
    typeArguments: typeArgs,
    arguments: newPoolArgs
  });

  return txb;
}

// 取得 pool 及 用戶 資訊
export async function getPoolAndUserInfo(userAddress: any) {

  let poolInfo: any = new Object();

  let poolList: Object[] = new Array<Object>();
  poolInfo.poolList = poolList;

  // 存放可以領獎的得獎者 陣列 
  // {poolId, round, luckNum}
  let canClaimRoundWinnerList: any[] = [];
  let totalStakeAmountMap: Map<any, any> = new Map();

  if (poolAddressConfigMap.size > 0) {

    for (let poolConfig of poolAddressConfigMap.values()) {

      if (poolConfig.pool === "") {
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

        poolObject.poolId = poolData.fields.id.id;
        poolObject.poolType = poolAddressConfigMap.get(poolObject.poolId).poolType;
        poolObject.coinName = poolTypeCommonTypeMap.get(poolObject.poolType).coinName;
        poolObject.currentRound = poolData.fields.current_round;

        let decimal = poolTypeCommonTypeMap.get(poolObject.poolType)?.decimal;

        // 質押數量
        let statistics: any = new Object();
        statistics.totalStakeAmount = poolData.fields.statistics.fields.total_amount / decimal;
        statistics.userStakeArray = poolData.fields.statistics.fields.user_set.fields.contents;
        statistics.userStakeAmountMap = await getTableData(poolData.fields.statistics.fields.user_amount_table.fields.id.id);
        if (statistics.userStakeAmountMap) {
          let userStakeAmountMap = new Map();
          for (let [key, value] of statistics.userStakeAmountMap) {
            userStakeAmountMap.set(key, value / decimal);
          }
          statistics.userStakeAmountMap = userStakeAmountMap;
        }
        poolObject.statistics = statistics;
        totalStakeAmountMap.set(poolObject.poolType, statistics.totalStakeAmount);

        // 獎勵分配設定
        let rewardAllocate: any = new Object();
        rewardAllocate.allocateGasPayerRatio = (parseFloat(poolData.fields.reward_allocate.fields.allocate_gas_payer_ratio) / 100).toFixed(2);
        rewardAllocate.allocateUserAmount = poolData.fields.reward_allocate.fields.allocate_user_amount
        rewardAllocate.platformRatio = (parseFloat(poolData.fields.reward_allocate.fields.platform_ratio) / 100).toFixed(2);
        rewardAllocate.rewardRatio = (parseFloat(poolData.fields.reward_allocate.fields.reward_ratio) / 100).toFixed(2);
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
        if (poolConfig.shareSupply !== "") {
          poolObject.shareSupplyInfo = await getShareSupply(poolConfig.shareSupply, decimal);
        }

        // 已領取獎勵的Map<round, address>
        let claimedMap = await getTableData(poolData.fields.claimed.fields.id.id);
        poolObject.claimedMap = claimedMap;

        let claimRoundWinnerList: any = [];
        poolObject.claimRoundWinnerList = claimRoundWinnerList;

        let dynamicFieldsResp = await suiClient.getDynamicFields({
          parentId: poolConfig.pool,
        });

        if (dynamicFieldsResp.data) {
          let array = dynamicFieldsResp.data;
          let expireTimeMap: any = new Map();
          for (let dynamicFields of array) {
            if (dynamicFields.objectType === "u64") {
              // 得獎 round - 幸運號碼
              let winnerObjResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (winnerObjResp.data?.content) {
                let dataContent: any = winnerObjResp.data.content;
                let round = dataContent.fields.name;
                claimRoundWinnerList.push(
                  {
                    poolId: poolObject.poolId,
                    round: round,
                    luckNum: dataContent.fields.value
                  }
                );
              }
            } else if (dynamicFields.name.type === `${PACKAGE_ID}::pool::ClaimExpiredTime`) {
              // 取得到期時間
              let expireDynamicFieldsResp = await suiClient.getDynamicFields({
                parentId: dynamicFields.objectId,
              });
              if (expireDynamicFieldsResp.data) {
                let expireDynamicFieldDataArray = expireDynamicFieldsResp.data;
                for (let expireDynamicFieldData of expireDynamicFieldDataArray) {
                  let expireData = await suiClient.getObject({
                    id: expireDynamicFieldData.objectId,
                    options: {
                      showContent: true
                    }
                  });
                  if (expireData.data?.content) {
                    let expireDataContent: any = expireData.data.content;
                    expireTimeMap.set(expireDataContent.fields.name, expireDataContent.fields.value);
                  }
                }
              }
            }
          }
          // 檢查是否過期
          let nowTime = new Date();
          for (let claimRoundWinner of claimRoundWinnerList) {
            if (claimedMap && claimedMap.has(claimRoundWinner.round)) {
              continue;
            }
            let expireTime = expireTimeMap.get(claimRoundWinner.round);
            if (expireTime) {
              if (nowTime > new Date(Number(expireTime))) {
                console.error(`round ${claimRoundWinner.round} is expired : ${new Date(Number(expireTime)).toLocaleString()}`);
                continue;
              }
            }
            canClaimRoundWinnerList.push(claimRoundWinner);
          }

        }

        poolList.push(poolObject);
      }
    }

    poolInfo.userStakeTicketList = await getUserStakeTicketList(userAddress, canClaimRoundWinnerList, totalStakeAmountMap);
  }

  return poolInfo;
}

// 取得 用戶質押票券資訊 列表
async function getUserStakeTicketList(
  address: string,
  canClaimRoundWinnerList: any[],
  totalStakeAmountMap: Map<any, any>
) {
  let userStakeTicketList: any[] = [];

  if (address) {
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
      for (let resp of objectResponse.data) {
        let userStakeTicket: any = new Object();
        userStakeTicket.id = resp.data.content.fields.id.id;
        let startNum = resp.data.content.fields.start_num;
        let endNum = resp.data.content.fields.end_num;
        let winnerInfoList: any[] = [];
        userStakeTicket.winnerInfoList = winnerInfoList;
        for (let winnerInfo of canClaimRoundWinnerList) {
          let luckNum = winnerInfo.luckNum;
          if (Number(luckNum) >= Number(startNum) && Number(luckNum) <= Number(endNum)) {
            winnerInfoList.push(winnerInfo);
          }
        }
        userStakeTicket.startNum = startNum;
        userStakeTicket.endNum = endNum;
        userStakeTicket.poolType = resp.data.content.type.split(",")[0].split("::")[4];
        userStakeTicket.coinName = poolTypeCommonTypeMap.get(userStakeTicket.poolType).coinName;

        let decimal = SUI_COIN_DECIMAL;
        switch (userStakeTicket.poolType) {
          case PoolTypeEnum.SCALLOP_PROTOCOL:
            decimal = SCA_COIN_DECIMAL;
            break;
          case PoolTypeEnum.BUCKET_PROTOCOL:
            decimal = BUCK_COIN_DECIMAL;
            break;
        }

        let dynamicDataResp = await suiClient.getDynamicFields({
          parentId: userStakeTicket.id
        });

        if (dynamicDataResp.data) {
          for (let dynamicData of dynamicDataResp.data) {
            if (dynamicData.objectType === "u64") {
              let dynamicObjectMap = await getTableRawData(
                userStakeTicket.id,
                dynamicData.name.type,
                dynamicData.name.value
              );
              let stakeAmount = dynamicObjectMap.get(userStakeTicket.id);

              userStakeTicket.amount = stakeAmount / decimal;
              userStakeTicket.luckRate = (userStakeTicket.amount / totalStakeAmountMap.get(userStakeTicket.poolType)) * 100;
            }
          }
        }

        userStakeTicketList.push(userStakeTicket);
      }
    }
  }

  return userStakeTicketList;
}

// 取得 pool 及 用戶 資訊 V2
export async function getPoolAndUserInfoV2(userAddress: any) {

  let poolInfo: any = new Object();

  let poolList: Object[] = new Array<Object>();
  poolInfo.poolList = poolList;

  // 存放可以領獎的得獎者 陣列 
  // {poolId, round, luckNum}
  let canClaimRoundWinnerList: any[] = [];
  let statisticsMap: Map<any, any> = new Map();

  if (poolAddressConfigMap.size > 0) {

    for (let poolConfig of poolAddressConfigMap.values()) {

      if (poolConfig.pool === "") {
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

        poolObject.poolId = poolData.fields.id.id;
        poolObject.poolType = poolAddressConfigMap.get(poolObject.poolId).poolType;
        poolObject.coinName = poolTypeCommonTypeMap.get(poolObject.poolType).coinName;
        poolObject.currentRound = poolData.fields.current_round;

        let decimal = poolTypeCommonTypeMap.get(poolObject.poolType)?.decimal;

        // 質押數量
        let statistics: any = new Object();
        statistics.totalStakeAmount = poolData.fields.statistics.fields.total_amount / decimal;
        statistics.userStakeArray = poolData.fields.statistics.fields.user_set.fields.contents;
        statistics.userStakeAmountMap = await getTableData(poolData.fields.statistics.fields.user_amount_table.fields.id.id);
        if (statistics.userStakeAmountMap) {
          let userStakeAmountMap = new Map();
          for (let [key, value] of statistics.userStakeAmountMap) {
            userStakeAmountMap.set(key, value / decimal);
          }
          statistics.userStakeAmountMap = userStakeAmountMap;
        }
        poolObject.statistics = statistics;
        statisticsMap.set(poolObject.poolType, statistics);

        // 獎勵分配設定
        let rewardAllocate: any = new Object();
        rewardAllocate.allocateGasPayerRatio = (parseFloat(poolData.fields.reward_allocate.fields.allocate_gas_payer_ratio) / 100).toFixed(2);
        rewardAllocate.allocateUserAmount = poolData.fields.reward_allocate.fields.allocate_user_amount
        rewardAllocate.platformRatio = (parseFloat(poolData.fields.reward_allocate.fields.platform_ratio) / 100).toFixed(2);
        rewardAllocate.rewardRatio = (parseFloat(poolData.fields.reward_allocate.fields.reward_ratio) / 100).toFixed(2);
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
        if (poolConfig.shareSupply !== "") {
          poolObject.shareSupplyInfo = await getShareSupply(poolConfig.shareSupply, decimal);
        }

        // 已領取獎勵的Map<round, address>
        let claimedMap = await getTableData(poolData.fields.claimed.fields.id.id);
        poolObject.claimedMap = claimedMap;

        let claimRoundWinnerList: any = [];
        poolObject.claimRoundWinnerList = claimRoundWinnerList;

        let dynamicFieldsResp = await suiClient.getDynamicFields({
          parentId: poolConfig.pool,
        });

        if (dynamicFieldsResp.data) {
          let array = dynamicFieldsResp.data;
          let expireTimeMap: any = new Map();
          for (let dynamicFields of array) {
            if (dynamicFields.objectType === "u64") {
              // 得獎 round - 幸運號碼
              let winnerObjResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (winnerObjResp.data?.content) {
                let dataContent: any = winnerObjResp.data.content;
                let round = dataContent.fields.name;
                claimRoundWinnerList.push(
                  {
                    poolId: poolObject.poolId,
                    poolType: poolObject.poolType,
                    round: round,
                    luckNum: dataContent.fields.value
                  }
                );
              }
            } else if (dynamicFields.name.type === `${PACKAGE_ID}::pool::ClaimExpiredTime`) {
              // 取得到期時間
              let expireDynamicFieldsResp = await suiClient.getDynamicFields({
                parentId: dynamicFields.objectId,
              });
              if (expireDynamicFieldsResp.data) {
                let expireDynamicFieldDataArray = expireDynamicFieldsResp.data;
                for (let expireDynamicFieldData of expireDynamicFieldDataArray) {
                  let expireData = await suiClient.getObject({
                    id: expireDynamicFieldData.objectId,
                    options: {
                      showContent: true
                    }
                  });
                  if (expireData.data?.content) {
                    let expireDataContent: any = expireData.data.content;
                    expireTimeMap.set(expireDataContent.fields.name, expireDataContent.fields.value);
                  }
                }
              }
            } else if (dynamicFields.objectType === `${PACKAGE_ID}::validator_adapter::StakedSuiStatus`) {
              let objResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (objResp.data?.content) {
                let dataContent: any = objResp.data.content;
                let validatorStatus: any = new Object();
                validatorStatus.available = dataContent.fields.value.fields.available;
                validatorStatus.lastEpoch = dataContent.fields.value.fields.last_epoch;
                validatorStatus.pending = dataContent.fields.value.fields.pending;
                poolObject.validatorStatus = validatorStatus;
              }
            }
          }
          // 檢查是否過期
          let nowTime = new Date();
          for (let claimRoundWinner of claimRoundWinnerList) {
            if (claimedMap && claimedMap.has(claimRoundWinner.round)) {
              continue;
            }
            let expireTime = expireTimeMap.get(claimRoundWinner.round);
            if (expireTime) {
              if (nowTime > new Date(Number(expireTime))) {
                // console.error(`round ${claimRoundWinner.round} is expired : ${new Date(Number(expireTime)).toLocaleString()}`);
                continue;
              }
              claimRoundWinner.expireTime = expireTime;
            }
            canClaimRoundWinnerList.push(claimRoundWinner);
          }

        }

        poolList.push(poolObject);
      }
    }
    poolInfo.userStakeInfoMap = await getUserInfoMapV2(userAddress, canClaimRoundWinnerList, statisticsMap);
  }

  return poolInfo;
}

// 取得 pool 資訊 V3
export async function getPoolInfoListV3(_poolType: any) {

  let poolInfo: any = new Object();

  let poolList: Object[] = new Array<Object>();
  poolInfo.poolList = poolList;

  // 存放可以領獎的得獎者 Map
  // {poolId, round, luckNum}
  let canClaimRoundWinnerMap: Map<any, any> = new Map();
  poolInfo.canClaimRoundWinnerMap = canClaimRoundWinnerMap;
  let statisticsMap: Map<any, any> = new Map();
  poolInfo.statisticsMap = statisticsMap;

  if (poolAddressConfigMap.size > 0) {

    for (let poolConfig of poolAddressConfigMap.values()) {

      if (poolConfig.pool === "") {
        continue;
      }
      if (_poolType && poolConfig.poolType !== _poolType) {
        continue;
      }

      let poolObjectResp = await suiClient.getObject({
        id: poolConfig.pool,
        options: {
          showContent: true
        }
      });
      if (poolObjectResp.data?.content) {

        console.log(poolObjectResp);

        let poolObject: any = new Object();

        let poolData: any = poolObjectResp.data.content;

        poolObject.poolId = poolData.fields.id.id;
        poolObject.poolType = poolAddressConfigMap.get(poolObject.poolId).poolType;
        poolObject.coinName = poolTypeCommonTypeMap.get(poolObject.poolType).coinName;
        poolObject.currentRound = poolData.fields.current_round;

        let decimal = poolTypeCommonTypeMap.get(poolObject.poolType)?.decimal;

        // 質押數量
        let statistics: any = new Object();
        if (poolData.fields.statistics){
          statistics.totalStakeAmount = poolData.fields.statistics.fields.total_amount / decimal;
          statistics.userStakeArray = poolData.fields.statistics.fields.user_set.fields.contents;
          statistics.userStakeAmountMap = await getTableData(poolData.fields.statistics.fields.user_amount_table.fields.id.id);
          if (statistics.userStakeAmountMap) {
            let userStakeAmountMap = new Map();
            for (let [key, value] of statistics.userStakeAmountMap) {
              userStakeAmountMap.set(key, value / decimal);
            }
            statistics.userStakeAmountMap = userStakeAmountMap;
          }
        }
        poolObject.statistics = statistics;
        statisticsMap.set(poolObject.poolType, statistics);

        // 獎勵分配設定
        let rewardAllocate: any = new Object();
        rewardAllocate.allocateGasPayerRatio = (parseFloat(poolData.fields.reward_allocate.fields.allocate_gas_payer_ratio) / 100).toFixed(2);
        rewardAllocate.allocateUserAmount = poolData.fields.reward_allocate.fields.allocate_user_amount
        rewardAllocate.platformRatio = (parseFloat(poolData.fields.reward_allocate.fields.platform_ratio) / 100).toFixed(2);
        rewardAllocate.rewardRatio = (parseFloat(poolData.fields.reward_allocate.fields.reward_ratio) / 100).toFixed(2);
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
        if (poolConfig.shareSupply !== "") {
          poolObject.shareSupplyInfo = await getShareSupply(poolConfig.shareSupply, decimal);
        }

        // 已領取獎勵的Map<round, address>
        let claimedMap = await getTableData(poolData.fields.claimed.fields.id.id);
        poolObject.claimedMap = claimedMap;

        let claimableMap = await getTableData(poolData.fields.claimable.fields.id.id);
        console.log(claimableMap);

        let claimRoundWinnerList: any = [];
        poolObject.claimRoundWinnerList = claimRoundWinnerList;

        let dynamicFieldsResp = await suiClient.getDynamicFields({
          parentId: poolConfig.pool,
        });

        if (dynamicFieldsResp.data) {
          let array = dynamicFieldsResp.data;
          let expireTimeMap: any = new Map();
          for (let dynamicFields of array) {
            if (dynamicFields.objectType === "u64") {
              // 得獎 round - 幸運號碼
              let winnerObjResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (winnerObjResp.data?.content) {
                let dataContent: any = winnerObjResp.data.content;
                let round = dataContent.fields.name;
                claimRoundWinnerList.push(
                  {
                    poolId: poolObject.poolId,
                    poolType: poolObject.poolType,
                    round: round,
                    luckNum: dataContent.fields.value
                  }
                );
              }
            } else if (dynamicFields.name.type === `${PACKAGE_ID}::pool::ClaimExpiredTime`) {
              // 取得到期時間
              let expireDynamicFieldsResp = await suiClient.getDynamicFields({
                parentId: dynamicFields.objectId,
              });
              if (expireDynamicFieldsResp.data) {
                let expireDynamicFieldDataArray = expireDynamicFieldsResp.data;
                for (let expireDynamicFieldData of expireDynamicFieldDataArray) {
                  let expireData = await suiClient.getObject({
                    id: expireDynamicFieldData.objectId,
                    options: {
                      showContent: true
                    }
                  });
                  if (expireData.data?.content) {
                    let expireDataContent: any = expireData.data.content;
                    expireTimeMap.set(expireDataContent.fields.name, expireDataContent.fields.value);
                  }
                }
              }
            } else if (dynamicFields.objectType === `${PACKAGE_ID}::validator_adapter::StakedSuiStatus`) {
              let objResp = await suiClient.getObject({
                id: dynamicFields.objectId,
                options: {
                  showContent: true
                }
              });
              if (objResp.data?.content) {
                let dataContent: any = objResp.data.content;
                let validatorStatus: any = new Object();
                validatorStatus.available = dataContent.fields.value.fields.available;
                validatorStatus.lastEpoch = dataContent.fields.value.fields.last_epoch;
                validatorStatus.pending = dataContent.fields.value.fields.pending;
                poolObject.validatorStatus = validatorStatus;
              }
            }
          }
          // 檢查是否過期
          let nowTime = new Date();
          let canClaimRoundWinnerList = [];
          for (let claimRoundWinner of claimRoundWinnerList) {
            if (claimedMap && claimedMap.has(claimRoundWinner.round)) {
              continue;
            }
            let expireTime = expireTimeMap.get(claimRoundWinner.round);
            if (expireTime) {
              if (nowTime > new Date(Number(expireTime))) {
                // console.error(`round ${claimRoundWinner.round} is expired : ${new Date(Number(expireTime)).toLocaleString()}`);
                continue;
              }
              claimRoundWinner.expireTime = expireTime;
            }
            canClaimRoundWinnerList.push(claimRoundWinner);
          }
          canClaimRoundWinnerMap.set(poolObject.poolType, canClaimRoundWinnerList);
        }

        poolList.push(poolObject);
      }
    }
  }
  return poolInfo;
}

// 取得 供應 資訊
async function getShareSupply(shareSupplyId: string, decimal: number) {
  let objectResponse = await suiClient.getObject({
    id: shareSupplyId,
    options: {
      showContent: true
    }
  });
  let obj: any = new Object();
  if (objectResponse.data?.content) {
    let data: any = objectResponse.data.content;
    obj.totalSupply = data.fields.total_supply / decimal;
    obj.activeSupply = data.fields.active_supply / decimal;
  }
  return obj;
}

// 取得 用戶資訊 Map V2
async function getUserInfoMapV2(
  address: string,
  canClaimRoundWinnerList: any[],
  statisticsMap: Map<any, any>
) {

  let userStakeInfoMap: Map<any, any> = new Map();

  Array.from(poolTypeCommonTypeMap.keys()).map((poolType: any) => {

    let statistics = statisticsMap.get(poolType);

    if (statistics != null) {
      let totalStakeAmount = statistics.totalStakeAmount;

      let userStakeTotalAmount: number =
        statistics.userStakeAmountMap.has(address)
          ? statistics.userStakeAmountMap.get(address)
          : 0;

      let luckRate: number = userStakeTotalAmount == 0 ? 0 : (userStakeTotalAmount / totalStakeAmount) * 100

      userStakeInfoMap.set(poolType, {
        userStakeTotalAmount: userStakeTotalAmount,
        luckRate: luckRate,
        coinName: poolTypeCommonTypeMap.get(poolType).coinName,
        winnerInfoList: []
      });
    }
  });

  if (address) {
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
      for (let resp of objectResponse.data) {

        let stakeShareId = resp.data.content.fields.id.id;
        let startNum = resp.data.content.fields.start_num;
        let endNum = resp.data.content.fields.end_num;
        let poolType = resp.data.content.type.split(",")[0].split("::")[4];

        for (let winnerInfo of canClaimRoundWinnerList) {
          if (winnerInfo.poolType !== poolType) {
            continue;
          }
          let luckNum = winnerInfo.luckNum;
          if (Number(luckNum) >= Number(startNum) && Number(luckNum) <= Number(endNum)) {
            winnerInfo.stakeShareId = stakeShareId;
            userStakeInfoMap.get(poolType).winnerInfoList.push(winnerInfo);
          }
        }
      }
    }
  }

  return userStakeInfoMap;
}

// 取得 用戶資訊 V3
export async function getUserStakeInfoV3(
  address: string,
  _poolType: any,
  canClaimRoundWinnerMap: Map<any, any>,
  statisticsMap: Map<any, any>
) {

  let userStakeInfo: any = new Object();

  let userStakeInfoMap: Map<any, any> = new Map();
  userStakeInfo.userStakeInfoMap = userStakeInfoMap;

  let poolTypeCommonTypeList = poolTypeCommonTypeMap.keys();

  for (let poolType of poolTypeCommonTypeList) {
    if (_poolType && _poolType !== poolType) {
      continue;
    }

    console.log(statisticsMap);

    let statistics: any = statisticsMap.get(poolType);

    if (statistics != null) {
      // let totalStakeAmount = statistics.totalStakeAmount;

      // let userStakeTotalAmount: number =
      //   statistics.userStakeAmountMap.has(address)
      //     ? statistics.userStakeAmountMap.get(address)
      //     : 0;

      // let luckRate: number = userStakeTotalAmount == 0 ? 0 : (userStakeTotalAmount / totalStakeAmount) * 100

      userStakeInfoMap.set(poolType, {
        // userStakeTotalAmount: userStakeTotalAmount,
        // luckRate: luckRate,
        coinName: poolTypeCommonTypeMap.get(poolType).coinName,
        winnerInfoList: []
      });

      if (address) {
        let filterStract = filterMap.get(poolType);
        let objectResponse: any = await suiClient.getOwnedObjects({
          owner: address,
          options: {
            showContent: true
          },
          filter: {
            MatchAny: [filterStract]
          }
        });

        if (objectResponse.data) {
          for (let resp of objectResponse.data) {

            let stakeShareId = resp.data.content.fields.id.id;
            let startNum = resp.data.content.fields.start_num;
            let endNum = resp.data.content.fields.end_num;
            let poolType = resp.data.content.type.split(",")[0].split("::")[4];

            let canClaimRoundWinnerList = canClaimRoundWinnerMap.get(poolType);

            for (let winnerInfo of canClaimRoundWinnerList) {
              if (winnerInfo.poolType !== poolType) {
                continue;
              }
              let luckNum = winnerInfo.luckNum;
              if (Number(luckNum) >= Number(startNum) && Number(luckNum) <= Number(endNum)) {
                winnerInfo.stakeShareId = stakeShareId;
                userStakeInfoMap.get(poolType).winnerInfoList.push(winnerInfo);
              }
            }
          }
        }
      }
    }
  }
  return userStakeInfo;
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
  let poolType = poolConfig.poolType;

  let txb: TransactionBlock = new TransactionBlock();

  let args: TransactionArgument[] = [];
  let typeArgs: any[] = [];
  let decimal = poolTypeCommonTypeMap.get(poolType).decimal;
  let coinType = poolTypeCommonTypeMap.get(poolType).coinType;
  let coinObjectId: string = "";
  let needSplit = false;

  let walletBalance: any = await suiClient.getBalance({
    owner: address,
    coinType: coinType
  });

  let stakeCoinAmount: number = Number((stakeAmount * decimal));

  if (walletBalance.totalBalance < stakeCoinAmount) {
    alert("Not Enough Balance.");
    return null;
  } else if (walletBalance.totalBalance > stakeCoinAmount) {
    needSplit = true;
  }

  let walletCoinResp: any = await suiClient.getCoins({
    owner: address,
    coinType: coinType
  });

  let coinsArray = [];

  let index = 0;

  for (let coinInfo of walletCoinResp.data) {
    if (index == 0) {
      coinObjectId = coinInfo.coinObjectId;
    } else {
      coinsArray.push(coinInfo.coinObjectId);
    }
    index++;
  }

  if (coinsArray.length > 0) {
    txb.mergeCoins(coinObjectId, coinsArray)
  }

  let [realCoin]: any = [];
  if (needSplit) {
    if (poolType === PoolTypeEnum.VALIDATOR) {
      [realCoin] = txb.splitCoins(txb.gas, [txb.pure(stakeCoinAmount)]);
    } else {
      [realCoin] = txb.splitCoins(coinObjectId, [txb.pure(stakeCoinAmount)]);
    }
  }

  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:

      let validatorAddress = await getTopValidatorAddress();

      args = [
        // txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolId),
        txb.object(SUI_SYSTEM_STATE_ID),
        needSplit ? realCoin : txb.object(coinObjectId),
        txb.pure(validatorAddress),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_STAKE}`,
        arguments: args
      });
      break;

    case PoolTypeEnum.BUCKET_PROTOCOL:

      typeArgs = [
        BUCK_COIN_TYPE,
        SUI_COIN_TYPE
      ]

      args = [
        // txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolId),
        txb.object(BUCKET_FLASK),
        needSplit ? realCoin : txb.object(coinObjectId),
        txb.object(BUCKET_FOUTAIN),
        txb.pure.u64(BUCKET_LOCK_TIME),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_STAKE}`,
        typeArguments: typeArgs,
        arguments: args
      });
      break;

    case PoolTypeEnum.SCALLOP_PROTOCOL:

      typeArgs = [
        SCA_COIN_TYPE
      ]

      args = [
        // txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolId),
        txb.object(SCALLOP_VERSION),
        txb.object(SCALLOP_MARKET),
        needSplit ? realCoin : txb.object(coinObjectId),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_STAKE}`,
        typeArguments: typeArgs,
        arguments: args
      });

      break;
  }

  return txb;
}

// 建構 withdraw 的交易區塊
export async function packWithdrawTxb(
  poolType: string,
  stakePoolShareId: string,
  userStakeAmount: number,
  withdrawAmount: number
) {

  let txb: TransactionBlock = new TransactionBlock();

  let poolConfig = poolTypeConfigMap.get(poolType);
  let poolCommonType = poolTypeCommonTypeMap.get(poolType);

  let needSplit = false;

  if (withdrawAmount < userStakeAmount) {
    needSplit = true;
  }

  let args: TransactionArgument[] = [];
  let splitArgs: TransactionArgument[]
  let typeArgs: any[];
  let splitTypeArgs: any[];

  let [newShare]: any[] = [];

  if (needSplit) {
    // 切割 share
    splitArgs = [
      txb.object(stakePoolShareId),
      txb.pure(withdrawAmount * poolCommonType.decimal)
    ];

    splitTypeArgs = [
      `${PACKAGE_ID}::pool::${poolType}`,
      poolCommonType.nativeType,
      poolCommonType.rewardType
    ]

    newShare = txb.moveCall({
      target: `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${FUN_SPLIT_SHARE}`,
      arguments: splitArgs,
      typeArguments: splitTypeArgs
    });
  }

  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:

      args = [
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolConfig.pool),
        needSplit ? newShare : txb.object(stakePoolShareId),
        txb.object(SUI_SYSTEM_STATE_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_WITHDRAW}`,
        arguments: args
      });

      break;
    case PoolTypeEnum.BUCKET_PROTOCOL:

      typeArgs = [
        BUCK_COIN_TYPE,
        SUI_COIN_TYPE
      ]

      args = [
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolConfig.pool),
        txb.object(SUI_CLOCK_ID),
        txb.object(BUCKET_FLASK),
        txb.object(BUCKET_FOUTAIN),
        needSplit ? newShare : txb.object(stakePoolShareId),
        txb.pure.u64(BUCKET_LOCK_TIME)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_WITHDRAW}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
    case PoolTypeEnum.SCALLOP_PROTOCOL:

      typeArgs = [
        SCA_COIN_TYPE
      ]

      args = [
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolConfig.pool),
        needSplit ? newShare : txb.object(stakePoolShareId),
        txb.object(SCALLOP_VERSION),
        txb.object(SCALLOP_MARKET),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_WITHDRAW}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
  }

  return txb;
}

// 建構 withdraw 的交易區塊 V2
export async function packWithdrawTxbV2(
  address: string,
  poolType: string,
  withdrawAmount: number
) {

  if (address) {

    let txb: TransactionBlock = new TransactionBlock();

    let poolConfig = poolTypeConfigMap.get(poolType);
    let poolCommonType = poolTypeCommonTypeMap.get(poolType);
    let totalAmount: number = 0;
    let needBreak: boolean = false;

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
      for (let resp of objectResponse.data) {

        let args: TransactionArgument[] = [];
        let splitArgs: TransactionArgument[]
        let typeArgs: any[];
        let splitTypeArgs: any[];

        let [newShare]: any[] = [];

        let stakePoolShareId = resp.data.content.fields.id.id;
        let ticketPoolType = resp.data.content.type.split(",")[0].split("::")[4];

        if (poolType !== ticketPoolType) {
          continue;
        }

        let decimal = poolCommonType.decimal;

        let dynamicDataResp = await suiClient.getDynamicFields({
          parentId: stakePoolShareId
        });

        if (dynamicDataResp.data) {
          for (let dynamicData of dynamicDataResp.data) {
            if (dynamicData.objectType === "u64") {
              let dynamicObjectMap = await getTableRawData(
                stakePoolShareId,
                dynamicData.name.type,
                dynamicData.name.value
              );
              let startNum = resp.data.content.fields.start_num;
              let endNum = resp.data.content.fields.end_num;
              let stakeAmount = dynamicObjectMap.get(stakePoolShareId);
              let realAmount = stakeAmount / decimal;
              totalAmount = Number(totalAmount) + Number(realAmount);

              let rangeNum = endNum - startNum + 1
              let numRate = rangeNum / stakeAmount;

              if (withdrawAmount < totalAmount) {
                let shareAmount = Number(withdrawAmount) - (Number(totalAmount) - Number(realAmount));
                // 切割 share
                splitArgs = [
                  txb.object(stakePoolShareId),
                  txb.pure(parseInt((shareAmount * numRate * decimal).toString()))
                ];

                splitTypeArgs = [
                  `${PACKAGE_ID}::pool::${poolType}`,
                  poolCommonType.nativeType,
                  poolCommonType.rewardType
                ]

                newShare = txb.moveCall({
                  target: `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${FUN_SPLIT_SHARE}`,
                  arguments: splitArgs,
                  typeArguments: splitTypeArgs
                });

                switch (poolType) {
                  case PoolTypeEnum.VALIDATOR:

                    args = [
                      txb.object(poolConfig.shareSupply),
                      txb.object(poolConfig.numberPool),
                      txb.object(poolConfig.pool),
                      newShare,
                      txb.object(SUI_SYSTEM_STATE_ID)
                    ];

                    txb.moveCall({
                      target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_WITHDRAW}`,
                      arguments: args
                    });

                    break;
                  case PoolTypeEnum.BUCKET_PROTOCOL:

                    typeArgs = [
                      BUCK_COIN_TYPE,
                      SUI_COIN_TYPE
                    ]

                    args = [
                      txb.object(poolConfig.shareSupply),
                      txb.object(poolConfig.numberPool),
                      txb.object(poolConfig.pool),
                      txb.object(SUI_CLOCK_ID),
                      txb.object(BUCKET_FLASK),
                      txb.object(BUCKET_FOUTAIN),
                      newShare,
                      txb.pure.u64(BUCKET_LOCK_TIME)
                    ];

                    txb.moveCall({
                      target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_WITHDRAW}`,
                      arguments: args,
                      typeArguments: typeArgs
                    });

                    break;
                  case PoolTypeEnum.SCALLOP_PROTOCOL:

                    typeArgs = [
                      SCA_COIN_TYPE
                    ]

                    args = [
                      txb.object(poolConfig.shareSupply),
                      txb.object(poolConfig.numberPool),
                      txb.object(poolConfig.pool),
                      newShare,
                      txb.object(SCALLOP_VERSION),
                      txb.object(SCALLOP_MARKET),
                      txb.object(SUI_CLOCK_ID)
                    ];

                    txb.moveCall({
                      target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_WITHDRAW}`,
                      arguments: args,
                      typeArguments: typeArgs
                    });

                    needBreak = true;

                    break;
                }
                break;
              } else {
                switch (poolType) {
                  case PoolTypeEnum.VALIDATOR:

                    args = [
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

                    break;
                  case PoolTypeEnum.BUCKET_PROTOCOL:

                    typeArgs = [
                      BUCK_COIN_TYPE,
                      SUI_COIN_TYPE
                    ]

                    args = [
                      txb.object(poolConfig.shareSupply),
                      txb.object(poolConfig.numberPool),
                      txb.object(poolConfig.pool),
                      txb.object(SUI_CLOCK_ID),
                      txb.object(BUCKET_FLASK),
                      txb.object(BUCKET_FOUTAIN),
                      txb.object(stakePoolShareId),
                      txb.pure.u64(BUCKET_LOCK_TIME)
                    ];

                    txb.moveCall({
                      target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_WITHDRAW}`,
                      arguments: args,
                      typeArguments: typeArgs
                    });

                    break;
                  case PoolTypeEnum.SCALLOP_PROTOCOL:

                    typeArgs = [
                      SCA_COIN_TYPE
                    ]

                    args = [
                      txb.object(poolConfig.shareSupply),
                      txb.object(poolConfig.numberPool),
                      txb.object(poolConfig.pool),
                      txb.object(stakePoolShareId),
                      txb.object(SCALLOP_VERSION),
                      txb.object(SCALLOP_MARKET),
                      txb.object(SUI_CLOCK_ID)
                    ];

                    txb.moveCall({
                      target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_WITHDRAW}`,
                      arguments: args,
                      typeArguments: typeArgs
                    });
                    break;
                }
              }
            }
          }
        }

        if (needBreak) {
          break;
        }
      }
    }

    return txb;
  }

  return null;
}

// 建構 分配獎勵 的交易區塊
export async function packAllocateRewardsTxb(
  poolId: string
) {

  let poolConfig = poolAddressConfigMap.get(poolId);
  let poolType = poolConfig.poolType;

  let txb: TransactionBlock = new TransactionBlock();

  let args: TransactionArgument[];
  let typeArgs: any[];

  const theLatestBeacon = await fetchBeaconByTime(drandClient, Date.now())

  const drand_round: number = theLatestBeacon.round;
  const byteArray = hex16String2Vector(theLatestBeacon.signature);

  let validatorAddress = await getTopValidatorAddress();

  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:

      args = [
        txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(SUI_SYSTEM_STATE_ID),
        txb.object(poolId),
        txb.pure.address(validatorAddress),
        txb.pure.u64(drand_round),
        txb.pure(byteArray),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_ALLOCATE_REWARDS}`,
        arguments: args
      });

      break;
    case PoolTypeEnum.BUCKET_PROTOCOL:

      typeArgs = [
        BUCK_COIN_TYPE,
        SUI_COIN_TYPE
      ]

      args = [
        txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolId),
        txb.object(BUCKET_FOUTAIN),
        txb.pure.u64(drand_round),
        txb.pure(byteArray),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_ALLOCATE_REWARDS}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
    case PoolTypeEnum.SCALLOP_PROTOCOL:

      typeArgs = [
        SCA_COIN_TYPE
      ]

      args = [
        txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolId),
        txb.object(SCALLOP_VERSION),
        txb.object(SCALLOP_MARKET),
        txb.pure.u64(drand_round),
        txb.pure(byteArray),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_ALLOCATE_REWARDS}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
  }

  return txb;
}

// 建構 領取獎勵 的交易區塊
export async function packClaimRewardTxb(
  poolType: string,
  stakedShareId: string,
  winnerInfoList: any[]
) {

  let txb: TransactionBlock = new TransactionBlock();

  for (let winnerInfo of winnerInfoList) {

    let args: TransactionArgument[];
    let typeArgs: any[];

    switch (poolType) {
      case PoolTypeEnum.VALIDATOR:

        args = [
          txb.object(winnerInfo.poolId),
          txb.pure(winnerInfo.round),
          txb.makeMoveVec({ objects: [stakedShareId] }),
          txb.object(SUI_CLOCK_ID)
        ];

        txb.moveCall({
          target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_CLAIM_REWARD}`,
          arguments: args
        });

        break;
      case PoolTypeEnum.BUCKET_PROTOCOL:

        typeArgs = [
          BUCK_COIN_TYPE,
          SUI_COIN_TYPE
        ]

        args = [
          txb.object(winnerInfo.poolId),
          txb.pure(winnerInfo.round),
          txb.makeMoveVec({ objects: [stakedShareId] }),
          txb.object(SUI_CLOCK_ID)
        ];

        txb.moveCall({
          target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_CLAIM_REWARD}`,
          arguments: args,
          typeArguments: typeArgs
        });

        break;
      case PoolTypeEnum.SCALLOP_PROTOCOL:

        typeArgs = [
          BUCK_COIN_TYPE
        ]

        args = [
          txb.object(winnerInfo.poolId),
          txb.pure(winnerInfo.round),
          txb.makeMoveVec({ objects: [stakedShareId] }),
          txb.object(SUI_CLOCK_ID)
        ];

        txb.moveCall({
          target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_CLAIM_REWARD}`,
          arguments: args,
          typeArguments: typeArgs
        });

        break;
    }
  }

  return txb;
}

// 建構 領取獎勵 的交易區塊 V2
export async function packClaimRewardTxbV2(
  poolType: string,
  winnerInfo: any
) {

  let txb: TransactionBlock = new TransactionBlock();

  let args: TransactionArgument[];
  let typeArgs: any[];
  let stakedShareId = winnerInfo.stakeShareId;

  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:

      args = [
        txb.object(winnerInfo.poolId),
        txb.pure(winnerInfo.round),
        txb.makeMoveVec({ objects: [stakedShareId] }),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_VALIDATOR_ADAPTER}::${FUN_CLAIM_REWARD}`,
        arguments: args
      });

      break;
    case PoolTypeEnum.BUCKET_PROTOCOL:

      typeArgs = [
        BUCK_COIN_TYPE,
        SUI_COIN_TYPE
      ]

      args = [
        txb.object(winnerInfo.poolId),
        txb.pure(winnerInfo.round),
        txb.makeMoveVec({ objects: [stakedShareId] }),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_CLAIM_REWARD}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
    case PoolTypeEnum.SCALLOP_PROTOCOL:

      typeArgs = [
        BUCK_COIN_TYPE
      ]

      args = [
        txb.object(winnerInfo.poolId),
        txb.pure(winnerInfo.round),
        txb.makeMoveVec({ objects: [stakedShareId] }),
        txb.object(SUI_CLOCK_ID)
      ];

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_SCALLOP_ADAPTER}::${FUN_CLAIM_REWARD}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
  }

  return txb;
}

// 取得 供應 資訊
async function getTopValidatorAddress() {
  let objectResponse = await suiClient.getValidatorsApy();
  let address: string = "";
  let apy: number = 0;
  if (objectResponse.apys) {
    objectResponse.apys.map((apyObj: any) => {
      if (apyObj.apy > apy) {
        apy = apyObj.apy;
        address = apyObj.address;
      }
    })
  }
  return address;
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