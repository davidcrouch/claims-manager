import { Injectable, Logger } from '@nestjs/common';
import { AiMessageFeedbackRepository } from '../../database/repositories/ai-message-feedback.repository';
import { TenantContext } from '../../tenant/tenant-context';

export interface SubmitFeedbackDto {
  conversationId: string;
  messageId: string;
  rating: 'positive' | 'negative';
  categories?: string[];
  comment?: string;
}

@Injectable()
export class AiFeedbackService {
  private readonly logger = new Logger(AiFeedbackService.name);

  constructor(
    private readonly feedbackRepo: AiMessageFeedbackRepository,
    private readonly tenantContext: TenantContext,
  ) {}

  async submit(userId: string, dto: SubmitFeedbackDto) {
    const tenantId = this.tenantContext.getTenantId();
    this.logger.log(
      `[AiFeedbackService.submit] tenant=${tenantId} message=${dto.messageId} rating=${dto.rating}`,
    );
    return this.feedbackRepo.upsert({
      tenantId,
      userId,
      conversationId: dto.conversationId,
      messageId: dto.messageId,
      rating: dto.rating,
      categories: dto.categories ?? [],
      comment: dto.comment ?? null,
    });
  }

  async listForConversation(userId: string, conversationId: string) {
    const tenantId = this.tenantContext.getTenantId();
    return this.feedbackRepo.listByConversation(tenantId, conversationId, userId);
  }
}
