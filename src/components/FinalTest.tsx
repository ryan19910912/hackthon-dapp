import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import {
  getPoolTypeList,
  getPoolInfo,
  getClaimedRewardInfo,
  getRoundInfo,
  getUsdRateByPoolType,
  getUserBalanceInfo,
  getUserStakeInfo,
  getUserWinnerInfo,
  getRoundExpireTimeInfo,
  getCanClaimRewardInfo,
  getPoolRewardInfo,
  packStakeTxb,
  packWithdrawTxb,
  packAllocateRewardsTxb,
  packClaimRewardTxb,
  resetRewardAmount,
  saveClaimDigest,
  getClaimDigestList
} from "../api/sui_api_final_v2";
import { useState, useEffect } from 'react';

export function Test() {

  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransactionBlock();

  const [poolObjectMap, setPoolObjectMap] = useState<Map<any, any>>(new Map());

  useEffect(() => {
    async function run() {
      if (account) {

        let poolObjectMap = new Map();

        // 取得 Pool 類型陣列
        let poolTypeList = getPoolTypeList();
        console.log(poolTypeList);

        // 取得 Pool 資訊
        let poolInfo = await getPoolInfo(null);
        console.log(poolInfo);

        for (let pool of poolInfo.poolList) {

          console.log(`${pool.poolType} Start !!`);

          // 取得 已領取獎勵 資訊
          let claimedRewardMap = await getClaimedRewardInfo(pool.claimedRewardInfoId, [], pool.currentRound, pool.poolType);
          console.log(claimedRewardMap);

          // 取得 Round 中獎號碼 資訊
          let roundInfo = await getRoundInfo(pool.poolId, []);
          console.log(roundInfo);

          // 取得 Coin 對應的美元匯率
          let usdRateInfo = await getUsdRateByPoolType(pool.poolType);
          console.log(usdRateInfo);

          // 取得用戶 餘額
          let userBalanceInfo = await getUserBalanceInfo(account.address, pool.poolType);
          console.log(userBalanceInfo);

          // 取得用戶質押資訊
          let userStakeInfo = await getUserStakeInfo(account.address, pool.poolType, pool.statistics.totalDeposit);
          console.log(userStakeInfo);

          // 取得用戶中獎資訊
          let userWinnerInfo = await getUserWinnerInfo(
            pool.poolId,
            pool.currentRound,
            pool.claimedRewardInfoId,
            userStakeInfo.userTicketList
          );
          console.log(userWinnerInfo);

          // 取得 Round 的過期時間 資訊 Map
          let roundExpireTimeInfo = await getRoundExpireTimeInfo(pool.poolId, []);
          console.log(roundExpireTimeInfo);

          // 取得可領獎的 Round 資訊
          let canClaimRewardInfo = await getCanClaimRewardInfo(
            pool.poolId,
            pool.currentRound,
            pool.claimedRewardInfoId
          );
          console.log(canClaimRewardInfo);

          // 取得 Pool 獎勵數量 資訊
          let poolRewardInfo = await getPoolRewardInfo(pool.poolType);
          console.log(poolRewardInfo);

          let poolObject: any = new Object();
          poolObject.poolId = pool.poolId;
          poolObject.poolType = pool.poolType;
          poolObject.stakeAmount = pool.poolType === "VALIDATOR" ? 1 : 0.001;
          poolObject.withdrawAmount = pool.poolType === "VALIDATOR" ? 1 : 0.001;
          poolObject.winnerInfoList = userWinnerInfo.winnerInfoList;

          poolObjectMap.set(pool.poolType, poolObject);

          let claimSuccessDigestList = await getClaimDigestList(pool.poolType, account.address);
          console.log(claimSuccessDigestList);
        }

        setPoolObjectMap(poolObjectMap);
      }
    }
    run();
  }, [account]);

  return (
    <>
      <div>
        {account ?
          Array.from(poolObjectMap.keys()).map((poolType: any, index: any) => {
            return (
              <div key={index}>
                <h1>{poolType}</h1>
                <button className="Button green" onClick={() => packStakeTxb(
                  account.address,
                  poolObjectMap.get(poolType).poolId,
                  poolObjectMap.get(poolType).stakeAmount
                ).then((txb) => {
                  if (txb) {
                    signAndExecuteTransactionBlock(
                      {
                        transactionBlock: txb,
                        options: {
                          showBalanceChanges: true,
                          showObjectChanges: true,
                          showEvents: true,
                          showEffects: true,
                          showInput: true,
                          showRawInput: true
                        }
                      },
                      {
                        onSuccess: (successResult) => {
                          console.log('executed transaction block success', successResult);
                        },
                        onError: (errorResult) => {
                          console.error('executed transaction block error', errorResult);
                        },
                      },
                    );
                  }
                })}>
                  Stake
                </button>

                <button className="Button violet" onClick={() => packWithdrawTxb(
                  account.address,
                  poolType,
                  poolObjectMap.get(poolType).withdrawAmount
                ).then((txb) => {
                  if (txb) {
                    signAndExecuteTransactionBlock(
                      {
                        transactionBlock: txb,
                        options: {
                          showBalanceChanges: true,
                          showObjectChanges: true,
                          showEvents: true,
                          showEffects: true,
                          showInput: true,
                          showRawInput: true
                        }
                      },
                      {
                        onSuccess: (successResult) => {
                          console.log('executed transaction block success', successResult);
                        },
                        onError: (errorResult) => {
                          console.error('executed transaction block error', errorResult);
                        },
                      },
                    );
                  }
                })}>
                  Withdraw
                </button>


                <button className="Button violet" onClick={() => packAllocateRewardsTxb(
                  poolObjectMap.get(poolType).poolId
                ).then((txb) => {
                  if (txb) {
                    signAndExecuteTransactionBlock(
                      {
                        transactionBlock: txb,
                        options: {
                          showBalanceChanges: true,
                          showObjectChanges: true,
                          showEvents: true,
                          showEffects: true,
                          showInput: true,
                          showRawInput: true
                        }
                      },
                      {
                        onSuccess: (successResult) => {
                          console.log('executed transaction block success', successResult);
                          resetRewardAmount(poolType);
                        },
                        onError: (errorResult) => {
                          console.error('executed transaction block error', errorResult);
                        },
                      },
                    );
                  }
                })}>
                  Allocate Reward
                </button>

                <button className="Button violet" onClick={() => packClaimRewardTxb(
                  poolType,
                  poolObjectMap.get(poolType).winnerInfoList
                ).then((txb) => {
                  if (txb) {
                    signAndExecuteTransactionBlock(
                      {
                        transactionBlock: txb,
                        options: {
                          showBalanceChanges: true,
                          showObjectChanges: true,
                          showEvents: true,
                          showEffects: true,
                          showInput: true,
                          showRawInput: true
                        }
                      },
                      {
                        onSuccess: (successResult) => {
                          console.log('executed transaction block success', successResult);
                          saveClaimDigest(poolType, account.address, successResult);
                        },
                        onError: (errorResult) => {
                          console.error('executed transaction block error', errorResult);
                        },
                      },
                    );
                  }
                })}>
                  Claim Reward
                </button>

              </div>
            )
          })
          :
          <></>
        }
      </div>
    </>
  )
}