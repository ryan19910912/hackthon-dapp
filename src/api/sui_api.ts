import { TransactionBlock, TransactionArgument } from '@mysten/sui.js/transactions';
import { SuiClient, CoinBalance, SuiObjectDataFilter } from '@mysten/sui.js/client';
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
// SUI Coin Type
const SUI_COIN_TYPE: string = "0x2::sui::SUI";
// BUCK Coin Type
const BUCK_COIN_TYPE: string = `${import.meta.env.VITE_BUCK_COIN_TYPE}`;
// SBUCK Coin Type
const SBUCK_COIN_TYPE: string = `${import.meta.env.VITE_SBUCK_COIN_TYPE}`;

// Bucket 所需要的參數
const BUCKET_FLASK: string = `${import.meta.env.VITE_BUCKET_FLASK}`;
const BUCKET_FOUTAIN: string = `${import.meta.env.VITE_BUCKET_FOUTAIN}`;
const BUCKET_LOCK_TIME: number = Number(`${import.meta.env.VITE_BUCKET_LOCK_TIME}`);

// SUI Coin NATIVE_TYP
const COIN_TYPE: string = `0x2::coin::Coin`;
const STAKE_POOL_SHARE_TYPE: string = "StakedPoolShare";
// SUI Coin Decimal
const SUI_COIN_DECIMAL = 1_000_000_000;
const BUCK_COIN_DECIMAL = 1_000_000_000;

const poolTypeCommonTypeMap: any = new Map();
let filters: SuiObjectDataFilter[] = [];
Array.from(poolTypeConfigMap.keys()).map((poolType: any) => {
  console.log(poolType)
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
      nativeType = `${COIN_TYPE}<${SUI_COIN_TYPE}>`;
      coinName = "SCA";
      break;
  }
  let structType = `${PACKAGE_ID}::${MODULE_STAKED_SHARE}::${STAKE_POOL_SHARE_TYPE}
    <${PACKAGE_ID}::${MODULE_POOL}::${poolType},${nativeType}, ${rewardType}>`;
  let filter: SuiObjectDataFilter = {
    StructType: structType
  }
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
  console.log(Array.from(poolTypeConfigMap.keys()));
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
  poolId: string,
  poolType: string
) {
  let txb: TransactionBlock = new TransactionBlock();

  let nativeType: string = poolTypeCommonTypeMap.get(poolType).nativeType;
  let rewardType: string = poolTypeCommonTypeMap.get(poolType).rewardType;

  let typeArgs = [
    `${PACKAGE_ID}::${MODULE_POOL}::${poolType}`,
    nativeType, rewardType
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

// 取得 pool 資訊
export async function getPoolInfo() {

  let poolInfo: any = new Object();

  let poolList: Object[] = new Array<Object>();
  poolInfo.poolList = poolList;

  // 存放可以領獎的得獎者 陣列 
  // {poolId, round, luckNum}
  let canClaimRoundWinnerList: any[] = [];
  poolInfo.canClaimRoundWinnerList = canClaimRoundWinnerList;

  let totalSupplyMap: Map<any, any> = new Map();
  poolInfo.totalSupplyMap = totalSupplyMap;

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

        console.log(poolData);

        poolObject.poolId = poolData.fields.id.id;
        poolObject.poolType = poolAddressConfigMap.get(poolObject.poolId).poolType;
        poolObject.coinName = poolTypeCommonTypeMap.get(poolObject.poolType).coinName;

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
          console.log(poolObject.poolType);
          console.log(poolTypeCommonTypeMap);
          console.log(poolTypeCommonTypeMap.get(poolObject.poolType));
          let decimal = poolTypeCommonTypeMap.get(poolObject.poolType)?.decimal;
          poolObject.shareSupplyInfo = await getShareSupply(poolConfig.shareSupply, decimal);
          totalSupplyMap.set(poolObject.poolType, poolObject.shareSupplyInfo.totalSupply);
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
            } else if (dynamicFields.name.type === `${PACKAGE_ID}::pool::ClaimExpiredTime`){
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
          for (let claimRoundWinner of claimRoundWinnerList){
            if (claimedMap && claimedMap.has(claimRoundWinner.round)) {
              continue;
            }
            let expireTime = expireTimeMap.get(claimRoundWinner.round);
            if (expireTime){
              if (nowTime > new Date(Number(expireTime))){
                console.log(`round ${claimRoundWinner.round} is expired : ${new Date(Number(expireTime)).toLocaleString()}`);
                continue;
              }
            }
            canClaimRoundWinnerList.push(claimRoundWinner);
          }

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

// 取得 用戶質押票券資訊 列表
export async function getUserStakeTicketList(
  address: string,
  canClaimRoundWinnerList: any[],
  totalSupplyMap: Map<any, any>
) {
  let userStakeTicketList: any[] = [];

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
      let userStakeTicket: any = new Object();
      userStakeTicket.id = resp.data.content.fields.id.id;
      let startNum = resp.data.content.fields.start_num;
      let endNum = resp.data.content.fields.end_num;
      let winnerInfoList: any[] = [];
      userStakeTicket.winnerInfoList = winnerInfoList;
      for (let winnerInfo of canClaimRoundWinnerList) {
        let luckNum = winnerInfo.luckNum;
        console.log(luckNum);
        if (Number(luckNum) >= Number(startNum) && Number(luckNum) <= Number(endNum)) {
          winnerInfoList.push(winnerInfo);
        }
      }
      userStakeTicket.startNum = startNum;
      userStakeTicket.endNum = endNum;
      userStakeTicket.poolType = resp.data.content.type.split(",")[0].split("::")[4];
      userStakeTicket.coinName = poolTypeCommonTypeMap.get(userStakeTicket.poolType).coinName;
      userStakeTicket.amount = (Number(endNum) - Number(startNum) + 1) / SUI_COIN_DECIMAL;
      userStakeTicket.luckRate = (userStakeTicket.amount / totalSupplyMap.get(userStakeTicket.poolType)) * 100;
      userStakeTicketList.push(userStakeTicket);
    });
  }

  return userStakeTicketList;
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

  let validatorAddress = await getTopValidatorAddress();
  console.log("validatorAddress = " + validatorAddress);

  let args: TransactionArgument[] = [];
  let typeArgs: any[];
  let decimal = poolTypeCommonTypeMap.get(poolType).decimal;
  let coinType = poolTypeCommonTypeMap.get(poolType).coinType;
  let coinObjectId: string = "";

  let walletCoinResp: any = await suiClient.getCoins({
    owner: address,
    coinType: coinType
  });

  console.log(walletCoinResp);

  let stakeCoinAmount: number = Number((stakeAmount * decimal));

  for (let coinInfo of walletCoinResp.data){
    if (coinInfo.balance > stakeCoinAmount){
      coinObjectId = coinInfo.coinObjectId;
      break;
    }
  }

  if (coinObjectId === "") {
    alert("Not Enough Balance.");
  };

  console.log(coinObjectId);

  switch (poolType) {
    case PoolTypeEnum.VALIDATOR:

      args = [
        txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolId),
        txb.object(SUI_SYSTEM_STATE_ID),
        txb.splitCoins(txb.gas, [txb.pure(stakeCoinAmount)]),
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
        txb.object(GLOBAL_CONFIG_ID),
        txb.object(poolConfig.shareSupply),
        txb.object(poolConfig.numberPool),
        txb.object(poolId),
        txb.object(BUCKET_FLASK),
        txb.splitCoins(coinObjectId, [txb.pure(stakeCoinAmount)]),
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

      break;
  }

  console.log(args);

  return txb;
}

// 建構 withdraw 的交易區塊
export async function packWithdrawTxb(
  poolType: string,
  stakePoolShareId: string
) {

  let txb: TransactionBlock = new TransactionBlock();

  let poolConfig = poolTypeConfigMap.get(poolType);

  let args: TransactionArgument[] = [];
  let typeArgs: any[];

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

      console.log(args);

      txb.moveCall({
        target: `${PACKAGE_ID}::${MODULE_BUCKET_ADAPTER}::${FUN_WITHDRAW}`,
        arguments: args,
        typeArguments: typeArgs
      });

      break;
    case PoolTypeEnum.SCALLOP_PROTOCOL:
      break;
  }

  console.log(args);

  return txb;
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

    console.log(winnerInfo);

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
        break;
    }
  }

  console.log(txb.blockData)

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