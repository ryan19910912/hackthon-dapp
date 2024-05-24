import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { Container, Flex, Heading, Text, Button } from "@radix-ui/themes";
import {
  getPoolTypeList,
  packNewPoolTxb,
  packNewNumberPoolTxb,
  getPoolInfoListV3,
  getUserStakeInfoV3,
  packStakeTxb,
  packWithdrawTxbV2,
  packAllocateRewardsTxb,
  packClaimRewardTxbV2,
} from "../api/sui_api";
import { useState, useEffect } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import '../resource/style.css';
import { Cross2Icon } from '@radix-ui/react-icons';

export function Pool() {

  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransactionBlock();

  const [defaultPoolType, setDefaultPoolType] = useState("");
  const [poolType, setPoolType] = useState("");
  const [userStakeInfoMap, setUserStakeInfoMap] = useState(new Map<any, any>);
  const [prepareDuration, setPrepareDuration] = useState(0);
  const [lockStateDuration, setLockStateDuration] = useState(0);
  const [rewardDuration, setRewardDuration] = useState(0);
  const [expireDuration, setExpireDuration] = useState(0);
  const [platformRatio, setPlatformRatio] = useState(0);
  const [rewardRatio, setRewardRatio] = useState(0);
  const [allocateGasPayerRatio, setAllocateGasPayerRatio] = useState(0);
  const [poolList, setPoolList] = useState(new Array<any>());
  const [stakeAmount, setStakeAmount] = useState(0);
  const [withdrawAmount, setWithdrawAmount] = useState(0);
  const [poolTypeList, setPoolTypeList] = useState([]);
  const [canClaimRoundWinnerMap, setCanClaimRoundWinnerMap] = useState(new Map<any, any>);
  const [statisticsMap, setStatisticsMap] = useState(new Map<any, any>);

  useEffect(() => {
    if (account) {
      getPoolInfoListV3(null).then((poolInfo: any) => {
        console.log(poolInfo);
        setPoolList(poolInfo.poolList);
        setCanClaimRoundWinnerMap(poolInfo.canClaimRoundWinnerMap);
        setStatisticsMap(poolInfo.statisticsMap);
        getUserStakeInfoV3(
          account.address, 
          null, 
          poolInfo.canClaimRoundWinnerMap, 
          poolInfo.statisticsMap
        ).then((userStakeInfo: any) => {
          console.log(userStakeInfo);
          setUserStakeInfoMap(userStakeInfo.userStakeInfoMap);
        });
      });
      let poolTypeList: any = getPoolTypeList();
      setDefaultPoolType(poolTypeList[0])
      setPoolTypeList(poolTypeList);
    }
  }, [account]);

  function resetPoolInfo() {
    setPoolType(defaultPoolType);
    setPrepareDuration(0);
    setLockStateDuration(0);
    setRewardDuration(0);
    setExpireDuration(0);
    setPlatformRatio(0);
    setRewardRatio(0);
    setAllocateGasPayerRatio(0);
  }

  return (

    <Container my="2">
      {account ? (
        <Container my="2">
          <Heading mb="2">Wallet Status</Heading>
          <Flex direction="column">
            <Text>Wallet connected</Text>
            <Text>Address: {account.address}</Text>
            <Text>Network: {import.meta.env.VITE_SUI_NETWORK_NAME}</Text>
          </Flex>

          <Dialog.Root>
            <Dialog.Trigger asChild>
              <button className="Button violet" onClick={resetPoolInfo}>Create New Pool</button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="DialogOverlay" />
              <Dialog.Content className="DialogContent">
                <Dialog.Title className="DialogTitle">Create New Pool</Dialog.Title>
                <Dialog.Description className="DialogDescription">
                  You can create a new pool here.
                </Dialog.Description>
                <fieldset className="Fieldset">
                  <label className="Label">
                    Pool Type
                  </label>
                  <select className="Select" onChange={(e) => setPoolType(e.target.value)} defaultValue={poolType}>
                    {
                      poolTypeList.length > 0
                        ?
                        poolTypeList.map((poolType) => {
                          return (
                            <option key={poolType} value={poolType}>{poolType}</option>
                          )
                        })
                        :
                        <option>No Data</option>
                    }
                  </select>
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Prepare Duration</p>
                    (Second)
                  </label>
                  <input className="Input" type="number" value={prepareDuration}
                    onChange={(e) => setPrepareDuration(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Lock State Duration</p>
                    (Second)
                  </label>
                  <input className="Input" type="number" value={lockStateDuration}
                    onChange={(e) => setLockStateDuration(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Reward Duration</p>
                    (Second)
                  </label>
                  <input className="Input" type="number" value={rewardDuration}
                    onChange={(e) => setRewardDuration(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Expire Duration</p>
                    (Second)
                  </label>
                  <input className="Input" type="number" value={expireDuration}
                    onChange={(e) => setExpireDuration(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Reward Ratio</p>
                    (2 decimal places)
                  </label>
                  <input className="Input" type="number" value={rewardRatio} placeholder="99"
                    onChange={(e) => setRewardRatio(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Platform Ratio</p>
                    (2 decimal places)
                  </label>
                  <input className="Input" type="number" value={platformRatio} placeholder="0.5"
                    onChange={(e) => setPlatformRatio(Number(e.target.value))} />
                </fieldset>

                <fieldset className="Fieldset">
                  <label className="Label">
                    <p>Allocate Gas Payer Ratio</p>
                    (2 decimal places)
                  </label>
                  <input className="Input" type="number" value={allocateGasPayerRatio} placeholder="0.5"
                    onChange={(e) => setAllocateGasPayerRatio(Number(e.target.value))} />
                </fieldset>

                <div style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}>
                  <Dialog.Close asChild>
                    <Button className="Button green" onClick={() => packNewPoolTxb(
                      poolType,
                      prepareDuration,
                      lockStateDuration,
                      rewardDuration,
                      expireDuration,
                      platformRatio,
                      rewardRatio,
                      allocateGasPayerRatio
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
                              console.log('packNewPoolTxb success', successResult);
                            },
                            onError: (errorResult) => {
                              console.error('packNewPoolTxb error', errorResult);
                            },
                          },
                        );
                      }
                    })}>
                      Confirm
                    </Button>
                  </Dialog.Close>
                </div>
                <Dialog.Close asChild>
                  <button className="IconButton" aria-label="Close">
                    <Cross2Icon />
                  </button>
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <Heading mb="2">Pool List :</Heading>
          {poolList.length > 0
            ? poolList.map<any>((pool: any, index) => {
              return (
                <div key={index} style={{ border: '5px solid blue', padding: 10 }}>
                  <Flex>
                    Pool ID : {pool.poolId}
                  </Flex>
                  <Flex>
                    Pool Type : {pool.poolType}
                  </Flex>
                  <Flex>
                    Current Round : {pool.currentRound}
                  </Flex>
                  <Flex>
                    StartTime : {pool.timeInfo.startTime}
                  </Flex>
                  <Flex>
                    StartTime Format : {pool.timeInfo.startTimeFormat}
                  </Flex>
                  <Flex>
                    Reward Duration : {pool.timeInfo.rewardDuration}
                  </Flex>
                  <Flex>
                    RewardTime Format : {pool.timeInfo.rewardTimeFormat}
                  </Flex>
                  <Flex>
                    Allocate User Amount : {pool.rewardAllocate.allocateUserAmount}
                  </Flex>
                  <Flex>
                    Allocate Gas Payer Ratio : {pool.rewardAllocate.allocateGasPayerRatio} %
                  </Flex>
                  <Flex>
                    Platform Ratio : {pool.rewardAllocate.platformRatio} %
                  </Flex>
                  <Flex>
                    Reward Ratio : {pool.rewardAllocate.rewardRatio} %
                  </Flex>
                  <Flex>
                    Total Stake Amount : {pool.statistics?.totalStakeAmount} {pool.coinName}
                  </Flex>
                  <Flex>
                    Active Supply : {pool.shareSupplyInfo?.activeSupply} {pool.coinName}
                  </Flex>
                  <Flex>
                    Total Supply : {pool.shareSupplyInfo?.totalSupply} {pool.coinName}
                  </Flex>
                  {
                    pool.validatorStatus ?
                      <div>
                        <Flex>
                          Available : {pool.validatorStatus.available}
                        </Flex>
                        <Flex>
                          LastEpoch : {pool.validatorStatus.lastEpoch}
                        </Flex>
                        <Flex>
                          Pending : {pool.validatorStatus.pending}
                        </Flex>
                      </div>
                      :
                      <></>
                  }

                  {
                    pool.needNewNumberPool ?
                      <Button className="Button violet" onClick={() => packNewNumberPoolTxb(
                        pool.poolType
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
                        New Number Pool
                      </Button>
                      :
                      <></>
                  }

                  {
                    pool.canStake
                      ?
                      <Dialog.Root>
                        <Dialog.Trigger asChild>
                          <button className="Button violet" onClick={() => setStakeAmount(0)}>Stake</button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Overlay className="DialogOverlay" />
                          <Dialog.Content className="DialogContent">
                            <Dialog.Title className="DialogTitle">Stake</Dialog.Title>
                            <Dialog.Description className="DialogDescription">
                              You can stake {pool.coinName} coins in this pool.
                            </Dialog.Description>
                            <fieldset className="Fieldset">
                              <label className="Label">
                                Stake Amount ({pool.coinName})
                              </label>
                              <input className="Input" type="number" value={stakeAmount} onChange={(e) => setStakeAmount(Number(e.target.value))} />
                            </fieldset>

                            <div style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}>
                              <Dialog.Close asChild>
                                <Button className="Button green" onClick={() => packStakeTxb(
                                  account.address,
                                  pool.poolId,
                                  stakeAmount
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
                                  Confirm
                                </Button>
                              </Dialog.Close>
                            </div>
                            <Dialog.Close asChild>
                              <button className="IconButton" aria-label="Close">
                                <Cross2Icon />
                              </button>
                            </Dialog.Close>
                          </Dialog.Content>
                        </Dialog.Portal>
                      </Dialog.Root>
                      :
                      <></>
                  }

                  {
                    pool.canAllocateReward
                      ?
                      <div>
                        <Button className="Button violet" onClick={() => packAllocateRewardsTxb(
                          pool.poolId
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
                          Allocate Reward
                        </Button>
                      </div>
                      :
                      <div></div>
                  }
                </div>
              )
            })
            :
            <div> No Data </div>
          }

          <Heading mb="2">User Statke Info :</Heading>
          {
            userStakeInfoMap?.size > 0
              ?
              Array.from(userStakeInfoMap.keys()).map((poolType: any, index: any) => {
                return (
                  <div key={index} style={{ border: '5px solid green', padding: 10 }}>
                    <Flex>
                      Pool Type : {poolType}
                    </Flex>
                    <Flex>
                      Stake Total Amount : {userStakeInfoMap.get(poolType).userStakeTotalAmount}
                    </Flex>
                    <Flex>
                      Luck Rate : {userStakeInfoMap.get(poolType).luckRate} %
                    </Flex>
                    <Flex>
                      <Dialog.Root>
                        <Dialog.Trigger asChild>
                          <button className="Button violet" onClick={() => setWithdrawAmount(0)}>Withdraw</button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Overlay className="DialogOverlay" />
                          <Dialog.Content className="DialogContent">
                            <Dialog.Title className="DialogTitle">Withdraw</Dialog.Title>
                            <Dialog.Description className="DialogDescription">
                              Withdraw {userStakeInfoMap.get(poolType).coinName} coins
                            </Dialog.Description>
                            <fieldset className="Fieldset">
                              <label className="Label">
                                Withdraw Amount ({userStakeInfoMap.get(poolType).coinName})
                              </label>
                              <input className="Input" type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(Number(e.target.value))} />
                            </fieldset>

                            <div style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}>
                              <Dialog.Close asChild>
                                <Button className="Button violet" onClick={() => packWithdrawTxbV2(
                                  account.address,
                                  poolType,
                                  withdrawAmount
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
                                </Button>
                              </Dialog.Close>
                            </div>
                            <Dialog.Close asChild>
                              <button className="IconButton" aria-label="Close">
                                <Cross2Icon />
                              </button>
                            </Dialog.Close>
                          </Dialog.Content>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Flex>

                    {
                      userStakeInfoMap.get(poolType)?.winnerInfoList.length > 0
                        ?
                        userStakeInfoMap.get(poolType)?.winnerInfoList?.map((winnerInfo: any, index: any) => {
                          return (
                            <div key={index} style={{ border: '5px solid yellow', padding: 10 }}>
                              <h3>Bingo !!!</h3>
                              <Flex>
                                #week : {winnerInfo.round}
                              </Flex>
                              <Flex>
                                Expire Time : {winnerInfo.expireTime}
                              </Flex>
                              <Button className="Button violet" onClick={() => packClaimRewardTxbV2(
                                poolType,
                                winnerInfo
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
                                Claim Reward
                              </Button>
                            </div>
                          )
                        })
                        :
                        <></>
                    }
                  </div>
                )
              })
              :
              <></>
          }

        </Container>
      ) : (
        <Text>Wallet not connected</Text>
      )}

    </Container>
  );
}