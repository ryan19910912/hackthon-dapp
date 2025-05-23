import { ConnectButton } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading } from "@radix-ui/themes";
import { Pool } from "./components/Pool";
import { Test } from "./components/FinalTest";

function App() {
  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>Sui Hackthon Dapp</Heading>
        </Box>

        <Box>
          <ConnectButton />
        </Box>
      </Flex>
      <Container>
        <Container
          mt="5"
          pt="2"
          px="4"
          style={{ background: "var(--gray-a2)", minHeight: 500 }}
        >
          {/* <Pool /> */}
          <Test />
        </Container>
      </Container>
    </>
  );
}

export default App;
