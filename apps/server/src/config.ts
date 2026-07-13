export type ServerConfig = {
  host: string;
  port: number;
  clientOrigin: string;
  invitationBaseUrl: string;
};

export const getServerConfig = (): ServerConfig => ({
  host: process.env.HOST ?? "127.0.0.1",
  port: Number(process.env.PORT ?? "3001"),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:4173",
  invitationBaseUrl: process.env.INVITATION_BASE_URL ?? "http://127.0.0.1:4173"
});
