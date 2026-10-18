import { IsBoolean, IsNotEmpty, IsString } from "class-validator";

export class CreateFaceSwapConsentDto {
  @IsString()
  @IsNotEmpty()
  projectId: string;

  @IsBoolean()
  termsAccepted: boolean;

  @IsString()
  @IsNotEmpty()
  consentText: string;
}
