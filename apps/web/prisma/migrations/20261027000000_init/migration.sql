-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "marketingEmailConsent" BOOLEAN NOT NULL DEFAULT false,
    "marketingSmsConsent" BOOLEAN NOT NULL DEFAULT false,
    "consentAt" TIMESTAMP(3),
    "consentSource" TEXT,
    "unsubscribedAt" TIMESTAMP(3),
    "pushToken" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "totpSecret" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "totpLastStep" INTEGER,
    "recoveryCodes" TEXT[],
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "device" TEXT,
    "client" TEXT NOT NULL DEFAULT 'web',
    "ip" TEXT,
    "userAgent" TEXT,
    "mfa" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLog" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'PLATFORM',
    "orgId" TEXT,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "providerId" TEXT,
    "campaignId" TEXT,
    "automationKey" TEXT,
    "idempotencyKey" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "plugin" TEXT NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actor" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "data" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 0,
    "kycStatus" TEXT NOT NULL DEFAULT 'NONE',
    "kycProvider" TEXT,
    "kycSessionId" TEXT,
    "kycReport" JSONB,
    "legalName" TEXT,
    "dob" TIMESTAMP(3),
    "country" TEXT,
    "nationality" TEXT,
    "idNumberLast4" TEXT,
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "sanctionsHit" BOOLEAN NOT NULL DEFAULT false,
    "pepHit" BOOLEAN NOT NULL DEFAULT false,
    "screenedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "frozenReason" TEXT,
    "pinHash" TEXT,
    "pinFailed" INTEGER NOT NULL DEFAULT 0,
    "pinLockedUntil" TIMESTAMP(3),
    "stripeCustomerId" TEXT,
    "stripeCardholderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "heldCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayJournal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayLedgerLine" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "walletId" TEXT,
    "account" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,

    CONSTRAINT "PayLedgerLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayTopUp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "stripeSessionId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayTopUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRecipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "network" TEXT,
    "detailsEnc" TEXT NOT NULL,
    "label" TEXT,
    "providerRef" TEXT,
    "sanctionsHit" BOOLEAN NOT NULL DEFAULT false,
    "screenedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayTransfer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "sendCents" INTEGER NOT NULL,
    "sendCurrency" TEXT NOT NULL,
    "receiveCents" INTEGER NOT NULL,
    "receiveCurrency" TEXT NOT NULL,
    "rate" DECIMAL(20,8) NOT NULL,
    "feeCents" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "riskFlags" TEXT[],
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT,
    "stripeCardId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'VIRTUAL',
    "last4" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "expMonth" INTEGER NOT NULL,
    "expYear" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayFamilyMember" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "childUserId" TEXT,
    "name" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "inviteEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "weeklyLimitCents" INTEGER NOT NULL DEFAULT 5000,
    "perPurchaseLimitCents" INTEGER,
    "approvalOverCents" INTEGER,
    "blockedCategories" TEXT[],
    "allowedMerchants" TEXT[],
    "nightLock" BOOLEAN NOT NULL DEFAULT false,
    "onlineAllowed" BOOLEAN NOT NULL DEFAULT true,
    "countries" TEXT[],
    "allowanceCents" INTEGER NOT NULL DEFAULT 0,
    "allowanceWeekday" INTEGER NOT NULL DEFAULT 0,
    "lastAllowanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayFamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayCardEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "familyId" TEXT,
    "cardId" TEXT,
    "stripeAuthId" TEXT,
    "merchant" TEXT NOT NULL,
    "category" TEXT,
    "city" TEXT,
    "country" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayCardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayWatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "alertAbove" DOUBLE PRECISION,
    "alertBelow" DOUBLE PRECISION,
    "alertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayWatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayCoachThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayCoachThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayEsimOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'airalo',
    "packageId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dataLabel" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "providerOrderId" TEXT,
    "iccid" TEXT,
    "qrcodeUrl" TEXT,
    "lpa" TEXT,
    "journalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayEsimOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRiskEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "entity" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reviewedBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "PayRiskEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportCase" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'CHAT',
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AI_HANDLING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "category" TEXT,
    "assigneeId" TEXT,
    "aiSummary" TEXT,
    "sentiment" TEXT,
    "callSid" TEXT,
    "csat" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayRequest" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "journalRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayNotice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayHolding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" DECIMAL(24,10) NOT NULL,
    "costCents" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayHolding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayTrade" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "quantity" DECIMAL(24,10),
    "priceCents" INTEGER,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'alpaca',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filledAt" TIMESTAMP(3),

    CONSTRAINT "PayTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayBiller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'ops',
    "providerCode" TEXT,
    "accountLabel" TEXT NOT NULL DEFAULT 'Account number',
    "accountHint" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayBiller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayBillPayee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "billerId" TEXT NOT NULL,
    "nickname" TEXT,
    "accountEnc" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayBillPayee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayBillPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "feeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "repeat" TEXT,
    "confirmation" TEXT,
    "failureReason" TEXT,
    "journalRef" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PayBillPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayLoan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "principalCents" INTEGER NOT NULL,
    "aprBps" INTEGER NOT NULL,
    "termMonths" INTEGER NOT NULL,
    "paymentCents" INTEGER NOT NULL,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REVIEW',
    "decisionNote" TEXT,
    "decidedBy" TEXT,
    "scoreAtApply" INTEGER,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "nextDueAt" TIMESTAMP(3),
    "missed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disbursedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "PayLoan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayLoanPayment" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "principalCents" INTEGER NOT NULL,
    "interestCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DUE',
    "paidAt" TIMESTAMP(3),
    "journalRef" TEXT,

    CONSTRAINT "PayLoanPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayCreditScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" TEXT NOT NULL,
    "factors" JSONB NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'oenodpay',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayCreditScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "memo" TEXT,
    "reference" TEXT NOT NULL,
    "availableAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayReferral" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayReferredUser" (
    "id" TEXT NOT NULL,
    "referrerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayReferredUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayBooking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'duffel',
    "offerId" TEXT NOT NULL,
    "orderId" TEXT,
    "reference" TEXT,
    "title" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "providerAmount" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayTravelThread" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayTravelThread_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Session_userId_revokedAt_idx" ON "Session"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLog_idempotencyKey_key" ON "MessageLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "MessageLog_campaignId_idx" ON "MessageLog"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "PayProfile_userId_key" ON "PayProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayProfile_kycSessionId_key" ON "PayProfile"("kycSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "PayProfile_stripeCustomerId_key" ON "PayProfile"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "PayProfile_stripeCardholderId_key" ON "PayProfile"("stripeCardholderId");

-- CreateIndex
CREATE UNIQUE INDEX "PayWallet_userId_currency_key" ON "PayWallet"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "PayJournal_reference_key" ON "PayJournal"("reference");

-- CreateIndex
CREATE INDEX "PayJournal_userId_createdAt_idx" ON "PayJournal"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayLedgerLine_walletId_idx" ON "PayLedgerLine"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "PayTopUp_stripeSessionId_key" ON "PayTopUp"("stripeSessionId");

-- CreateIndex
CREATE INDEX "PayRecipient_userId_idx" ON "PayRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayTransfer_idempotencyKey_key" ON "PayTransfer"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayTransfer_userId_createdAt_idx" ON "PayTransfer"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayTransfer_status_idx" ON "PayTransfer"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayCard_stripeCardId_key" ON "PayCard"("stripeCardId");

-- CreateIndex
CREATE INDEX "PayCard_userId_idx" ON "PayCard"("userId");

-- CreateIndex
CREATE INDEX "PayFamilyMember_parentUserId_idx" ON "PayFamilyMember"("parentUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PayCardEvent_stripeAuthId_key" ON "PayCardEvent"("stripeAuthId");

-- CreateIndex
CREATE INDEX "PayCardEvent_userId_createdAt_idx" ON "PayCardEvent"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayWatch_userId_symbol_key" ON "PayWatch"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PayCoachThread_userId_key" ON "PayCoachThread"("userId");

-- CreateIndex
CREATE INDEX "PayEsimOrder_userId_idx" ON "PayEsimOrder"("userId");

-- CreateIndex
CREATE INDEX "PayRiskEvent_status_createdAt_idx" ON "PayRiskEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PayRiskEvent_userId_idx" ON "PayRiskEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportCase_callSid_key" ON "SupportCase"("callSid");

-- CreateIndex
CREATE INDEX "SupportCase_status_updatedAt_idx" ON "SupportCase"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportCase_userId_idx" ON "SupportCase"("userId");

-- CreateIndex
CREATE INDEX "SupportMessage_caseId_createdAt_idx" ON "SupportMessage"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "PayRequest_toUserId_status_idx" ON "PayRequest"("toUserId", "status");

-- CreateIndex
CREATE INDEX "PayRequest_fromUserId_createdAt_idx" ON "PayRequest"("fromUserId", "createdAt");

-- CreateIndex
CREATE INDEX "PayNotice_userId_createdAt_idx" ON "PayNotice"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayHolding_userId_symbol_key" ON "PayHolding"("userId", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "PayTrade_idempotencyKey_key" ON "PayTrade"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayTrade_userId_createdAt_idx" ON "PayTrade"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayTrade_status_idx" ON "PayTrade"("status");

-- CreateIndex
CREATE INDEX "PayBiller_country_active_idx" ON "PayBiller"("country", "active");

-- CreateIndex
CREATE INDEX "PayBillPayee_userId_idx" ON "PayBillPayee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayBillPayment_idempotencyKey_key" ON "PayBillPayment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayBillPayment_userId_createdAt_idx" ON "PayBillPayment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayBillPayment_status_scheduledFor_idx" ON "PayBillPayment"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "PayLoan_userId_idx" ON "PayLoan"("userId");

-- CreateIndex
CREATE INDEX "PayLoan_status_idx" ON "PayLoan"("status");

-- CreateIndex
CREATE INDEX "PayLoanPayment_loanId_dueAt_idx" ON "PayLoanPayment"("loanId", "dueAt");

-- CreateIndex
CREATE INDEX "PayLoanPayment_status_dueAt_idx" ON "PayLoanPayment"("status", "dueAt");

-- CreateIndex
CREATE INDEX "PayCreditScore_userId_createdAt_idx" ON "PayCreditScore"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayReward_reference_key" ON "PayReward"("reference");

-- CreateIndex
CREATE INDEX "PayReward_userId_status_idx" ON "PayReward"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayReferral_code_key" ON "PayReferral"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PayReferral_userId_key" ON "PayReferral"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayReferredUser_userId_key" ON "PayReferredUser"("userId");

-- CreateIndex
CREATE INDEX "PayReferredUser_referrerId_idx" ON "PayReferredUser"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "PayBooking_idempotencyKey_key" ON "PayBooking"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PayBooking_userId_createdAt_idx" ON "PayBooking"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayTravelThread_userId_key" ON "PayTravelThread"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayLedgerLine" ADD CONSTRAINT "PayLedgerLine_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "PayJournal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayLedgerLine" ADD CONSTRAINT "PayLedgerLine_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "PayWallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayTransfer" ADD CONSTRAINT "PayTransfer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PayRecipient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayBillPayee" ADD CONSTRAINT "PayBillPayee_billerId_fkey" FOREIGN KEY ("billerId") REFERENCES "PayBiller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayBillPayment" ADD CONSTRAINT "PayBillPayment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "PayBillPayee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayLoanPayment" ADD CONSTRAINT "PayLoanPayment_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "PayLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

