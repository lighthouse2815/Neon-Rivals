import { getServerConfig } from "./config";
import { createNeonDuelApp } from "./network/create-app";

const bootstrap = async (): Promise<void> => {
  const config = getServerConfig();
  const { app } = await createNeonDuelApp(config);

  try {
    await app.listen({
      host: config.host,
      port: config.port
    });
    app.log.info(`Neon Duel server ready at http://${config.host}:${config.port}`);
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
};

void bootstrap();
