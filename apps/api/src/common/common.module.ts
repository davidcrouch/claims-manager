import { Global, Module } from '@nestjs/common';
import { CredentialsCipher } from './credentials-cipher';
import { RecordNumberModule } from './record-number/record-number.module';

@Global()
@Module({
  imports: [RecordNumberModule],
  providers: [CredentialsCipher],
  exports: [CredentialsCipher],
})
export class CommonModule {}
