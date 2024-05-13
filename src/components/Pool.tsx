import { useCurrentAccount, useSignAndExecuteTransactionBlock } from "@mysten/dapp-kit";
import { Container, Flex, Heading, Text, Button, SelectItem } from "@radix-ui/themes";
import {
  getPoolTypeEnum,
  getUserStakeInfoList,
  packNewPoolTxb,
  packNewNumberPoolTxb,
  getPoolInfoList,
  packStakeTxb,
  packWithdrawTxb,
  packAllocateRewardsTxb,
  packClaimRewardTxb,
} from "../api/sui_api";
import { useState, useEffect } from 'react';

import * as Dialog from '@radix-ui/react-dialog';
import '../resource/style.css';
import { Cross2Icon, ChevronDownIcon, ChevronUpIcon } from '@radix-ui/react-icons';

export function Pool() {

  const account = useCurrentAccount();
  const { mutate: signAndExecuteTransactionBlock } = useSignAndExecuteTransactionBlock();

  const [defaultPoolType, setDefaultPoolType] = useState("");
  const [poolType, setPoolType] = useState("");
  const [userStakeInfoList, setUserStakeInfoList] = useState(new Array<any>());
  const [prepareDuration, setPrepareDuration] = useState(0);
  const [lockStateDuration, setLockStateDuration] = useState(0);
  const [rewardDuration, setRewardDuration] = useState(0);
  const [platformRatio, setPlatformRatio] = useState(0);
  const [rewardRatio, setRewardRatio] = useState(0);
  const [allocateGasPayerRatio, setAllocateGasPayerRatio] = useState(0);
  const [poolList, setPoolList] = useState(new Array<any>());
  const [stakeAmount, setStakeAmount] = useState(0);
  const [poolTypeMap, setPoolTypeMap] = useState(new Map());

  useEffect(() => {
    if (account) {
      getPoolInfoList().then((resp) => {
        setPoolList(resp);
        let canClaimRoundWinnerList: any[] = [];
        resp.map((poolInfo: any) => {
          canClaimRoundWinnerList.push.apply(canClaimRoundWinnerList, poolInfo.canClaimRoundWinnerList);
        });
        console.log(resp);
        getUserStakeInfoList(account.address, canClaimRoundWinnerList).then((resp) => {
          console.log(resp);
          setUserStakeInfoList(resp);
        });
      });
      let poolTypeEnum: any = getPoolTypeEnum();
      let poolTypeMap = new Map();
      Object.keys(poolTypeEnum).map((key, index) => {
        if (index == 0) {
          setDefaultPoolType(poolTypeEnum[key]);
          setPoolType(poolTypeEnum[key]);
        }
        poolTypeMap.set(key, poolTypeEnum[key]);
      });
      setPoolTypeMap(poolTypeMap);
    }
  }, [account]);

  function resetPoolInfo() {
    setPoolType(defaultPoolType);
    setPrepareDuration(0);
    setLockStateDuration(0);
    setRewardDuration(0);
    setPlatformRatio(0);
    setRewardRatio(0);
    setAllocateGasPayerRatio(0);
  }

  function resetStakeAmount() {
    setStakeAmount(0);
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
                      poolTypeMap.size > 0
                        ?
                        Array.from(poolTypeMap.keys()).map((key) => {
                          return (
                            <option key={key} value={poolTypeMap.get(key)}>{key}</option>
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
                    <p>Platform Ratio</p>
                    (2 decimal places)
                  </label>
                  <input className="Input" type="number" value={platformRatio} placeholder="0.5"
                    onChange={(e) => setPlatformRatio(Number(e.target.value))} />
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
                              console.log('packNewPoolTxb error', errorResult);
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
                    Active Supply : {pool.shareSupplyInfo?.activeSupply}
                  </Flex>
                  <Flex>
                    Total Supply : {pool.shareSupplyInfo?.totalSupply}
                  </Flex>

                  {
                    pool.needNewNumberPool ?
                      <Button className="Button violet" onClick={() => packNewNumberPoolTxb(
                        pool.poolId,
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
                                console.log('executed transaction block error', errorResult);
                              },
                            },
                          );
                        } else {
                          alert("Get Roll Dice Transaction Block Fail");
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
                          <button className="Button violet" onClick={resetStakeAmount}>Stake</button>
                        </Dialog.Trigger>
                        <Dialog.Portal>
                          <Dialog.Overlay className="DialogOverlay" />
                          <Dialog.Content className="DialogContent">
                            <Dialog.Title className="DialogTitle">Stake</Dialog.Title>
                            <Dialog.Description className="DialogDescription">
                              You can stake SUI coins in this pool.
                            </Dialog.Description>
                            <fieldset className="Fieldset">
                              <label className="Label">
                                Stake Amount (SUI)
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
                                          console.log('executed transaction block error', errorResult);
                                        },
                                      },
                                    );
                                  } else {
                                    alert("Get Roll Dice Transaction Block Fail");
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
                                  console.log('executed transaction block error', errorResult);
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

          <Heading mb="2">User Statke Info List :</Heading>
          {
            userStakeInfoList.length > 0
              ?
              userStakeInfoList.map<any>((userStakeInfo: any, index) => {
                return (
                  <div key={index} style={{ border: '5px solid green', padding: 10 }}>
                    <Flex>
                      Pool Type : {userStakeInfo.poolType}
                    </Flex>
                    <Flex>
                      Start Num : {userStakeInfo.startNum}
                    </Flex>
                    <Flex>
                      End Num : {userStakeInfo.endNum}
                    </Flex>
                    <Flex>
                      Stake SUI Amount : {userStakeInfo.suiAmount} SUI
                    </Flex>
                    <Flex>
                      <Button className="Button violet" onClick={() => packWithdrawTxb(
                        userStakeInfo.poolType,
                        userStakeInfo.id
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
                                console.log('executed transaction block error', errorResult);
                              },
                            },
                          );
                        }
                      })}>
                        Withdraw
                      </Button>
                    </Flex>
                    {
                      userStakeInfo.winnerInfoList.length > 0
                        ?
                        <div key={index} style={{ border: '5px solid yellow', padding: 10 }}>
                          <h3>Bingo !!!</h3>
                          <Button className="Button violet" onClick={() => packClaimRewardTxb(
                            userStakeInfo.id,
                            userStakeInfo.winnerInfoList
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
                                    console.log('executed transaction block error', errorResult);
                                  },
                                },
                              );
                            }
                          })}>
                            Claim Reward
                          </Button>
                        </div>
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