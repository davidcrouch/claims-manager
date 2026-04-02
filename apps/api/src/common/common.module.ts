import { Global, Module } from '@nestjs/common';
import { CredentialsCipher } from './credentials-cipher';

@Global()
@Module({
  providers: [CredentialsCipher],
  exports: [CredentialsCipher],
})
export class CommonModule {}
