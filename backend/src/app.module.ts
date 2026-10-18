import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { MediaModule } from "./modules/media/media.module";
import { JobsModule } from "./modules/jobs/jobs.module";
import { UsersModule } from "./modules/users/users.module";
import { ConsentsModule } from "./modules/consents/consents.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../.env"],
    }),
    PrismaModule,
    AuthModule,
    ProjectsModule,
    MediaModule,
    JobsModule,
    UsersModule,
    ConsentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
