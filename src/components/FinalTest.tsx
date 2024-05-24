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
  getCanClaimRewardInfo
} from "../api/sui_api_final";
import { useState, useEffect } from 'react';

export function Test() {

  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransactionBlock();

  useEffect(() => {
    async function run() {
      if (account) {

        // 取得 Pool 資訊
        let poolInfo = await getPoolInfo(null);
        console.log(poolInfo);

        // 取得 已領取獎勵 資訊
        let claimedRewardMap = await getClaimedRewardInfo(poolInfo.poolList[0].claimedRewardInfoId, []);
        console.log(claimedRewardMap);

        // 取得 Round 中獎號碼 資訊
        let roundInfo = await getRoundInfo(poolInfo.poolList[0].poolId, []);
        console.log(roundInfo);

        // 取得 SCA Coin 對應的美元匯率
        let scaUsdRateInfo = await getUsdRateByPoolType("SCALLOP_PROTOCOL");
        console.log(scaUsdRateInfo);

        // 取得 BUCK Coin 對應的美元匯率
        let buckUsdRateInfo = await getUsdRateByPoolType("BUCKET_PROTOCOL");
        console.log(buckUsdRateInfo);

        // 取得用戶 餘額
        let userBalanceInfo = await getUserBalanceInfo(account.address, null);
        console.log(userBalanceInfo);

        // 取得用戶質押資訊
        let userStakeInfo = await getUserStakeInfo(account.address, "BUCKET_PROTOCOL", poolInfo.poolList[0].statistics.totalDeposit);
        console.log(userStakeInfo);

        // 取得用戶中獎資訊
        let userWinnerInfo = await getUserWinnerInfo(
          poolInfo.poolList[0].poolId,
          poolInfo.poolList[0].currentRound,
          poolInfo.poolList[0].claimedRewardInfoId,
          userStakeInfo.userTicketList
        );
        console.log(userWinnerInfo);

        let roundExpireTimeInfo = await getRoundExpireTimeInfo(poolInfo.poolList[0].poolId, []);
        console.log(roundExpireTimeInfo);

        let canClaimRewardInfo = await getCanClaimRewardInfo(
          poolInfo.poolList[0].poolId, 
          poolInfo.poolList[0].currentRound,
          poolInfo.poolList[0].claimedRewardInfoId
        );
        console.log(canClaimRewardInfo);
      }
    }
    run();
  }, [account]);

  return (
    <>
    </>
  )
}