/**
 * prisma/seed.ts
 *
 * Phase 1 テストデータ
 * 実行: npx prisma db seed
 *
 * 投入するデータ:
 *   - 4名のメンバー（admin/manager/employee/intern 各1名）
 *   - 4件の user_accounts（上記に対応）
 *   - 3つのスキルカテゴリ + 9つのスキル
 *   - 各メンバーのスキル評価
 *   - 各メンバーの利用ツール
 *   - デモ用プロジェクト2件
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── 固定 UUID（UUID v4 互換形式） ──────────────────────────────────────────
// 形式: xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx（Zod .uuid() 通過済み）
const ID = {
  // members
  memberSato:   "00000000-0000-4000-a000-000000000001",
  memberTanaka: "00000000-0000-4000-a000-000000000002",
  memberSuzuki: "00000000-0000-4000-a000-000000000003",
  memberYamada: "00000000-0000-4000-a000-000000000004",
  // user_accounts
  userSato:     "10000000-0000-4000-a000-000000000001",
  userTanaka:   "10000000-0000-4000-a000-000000000002",
  userSuzuki:   "10000000-0000-4000-a000-000000000003",
  userYamada:   "10000000-0000-4000-a000-000000000004",
  // skill_categories
  catEng:       "20000000-0000-4000-a000-000000000001",
  catAI:        "20000000-0000-4000-a000-000000000002",
  catBiz:       "20000000-0000-4000-a000-000000000003",
  // skills
  skillFE:      "30000000-0000-4000-a000-000000000001",
  skillBE:      "30000000-0000-4000-a000-000000000002",
  skillDB:      "30000000-0000-4000-a000-000000000003",
  skillML:      "30000000-0000-4000-a000-000000000004",
  skillPrompt:  "30000000-0000-4000-a000-000000000005",
  skillRAG:     "30000000-0000-4000-a000-000000000006",
  skillPM:      "30000000-0000-4000-a000-000000000007",
  skillSales:   "30000000-0000-4000-a000-000000000008",
  skillDoc:     "30000000-0000-4000-a000-000000000009",
  // projects
  project1:     "40000000-0000-4000-a000-000000000001",
  project2:     "40000000-0000-4000-a000-000000000002",
};

async function main() {
  console.log("🌱 Seeding database...");

  // ─── メンバー作成 ──────────────────────────────────────────────────────────
  console.log("  Creating members...");

  const memberSato = await prisma.member.upsert({
    where: { id: ID.memberSato },
    update: {},
    create: {
      id: ID.memberSato,
      name: "佐藤 健太",
      status: "executive",
      salaryType: "monthly",
      salaryAmount: 500000,
      joinedAt: new Date("2023-04-01"),
    },
  });

  const memberTanaka = await prisma.member.upsert({
    where: { id: ID.memberTanaka },
    update: {},
    create: {
      id: ID.memberTanaka,
      name: "田中 一郎",
      status: "employee",
      salaryType: "monthly",
      salaryAmount: 350000,
      joinedAt: new Date("2024-01-15"),
    },
  });

  const memberSuzuki = await prisma.member.upsert({
    where: { id: ID.memberSuzuki },
    update: {},
    create: {
      id: ID.memberSuzuki,
      name: "鈴木 花子",
      status: "employee",
      salaryType: "monthly",
      salaryAmount: 300000,
      joinedAt: new Date("2024-06-01"),
    },
  });

  const memberYamada = await prisma.member.upsert({
    where: { id: ID.memberYamada },
    update: {},
    create: {
      id: ID.memberYamada,
      name: "山田 さくら",
      status: "intern_training",
      salaryType: "hourly",
      salaryAmount: 1500,
      joinedAt: new Date("2026-01-06"),
    },
  });

  const members = [memberSato, memberTanaka, memberSuzuki, memberYamada];
  console.log(`  ✓ ${members.length} members created`);

  // ─── user_accounts 作成 ─────────────────────────────────────────────────────
  console.log("  Creating user accounts...");

  const SALT_ROUNDS = 12;
  const defaultPassword = await bcrypt.hash("Password123", SALT_ROUNDS);

  await prisma.userAccount.upsert({
    where: { email: "sato@example.com" },
    update: {},
    create: {
      id: ID.userSato,
      email: "sato@example.com",
      passwordHash: defaultPassword,
      role: "admin",
      memberId: memberSato.id,
    },
  });

  await prisma.userAccount.upsert({
    where: { email: "tanaka@example.com" },
    update: {},
    create: {
      id: ID.userTanaka,
      email: "tanaka@example.com",
      passwordHash: defaultPassword,
      role: "manager",
      memberId: memberTanaka.id,
    },
  });

  await prisma.userAccount.upsert({
    where: { email: "suzuki@example.com" },
    update: {},
    create: {
      id: ID.userSuzuki,
      email: "suzuki@example.com",
      passwordHash: defaultPassword,
      role: "manager",
      memberId: memberSuzuki.id,
    },
  });

  await prisma.userAccount.upsert({
    where: { email: "yamada@example.com" },
    update: {},
    create: {
      id: ID.userYamada,
      email: "yamada@example.com",
      passwordHash: defaultPassword,
      role: "member",
      memberId: memberYamada.id,
    },
  });

  console.log("  ✓ 4 user accounts created (password: Password123)");

  // ─── スキルカテゴリ & スキル ─────────────────────────────────────────────────
  console.log("  Creating skill categories and skills...");

  const catEng = await prisma.skillCategory.upsert({
    where: { name: "エンジニアリング" },
    update: {},
    create: {
      id: ID.catEng,
      name: "エンジニアリング",
      description: "ソフトウェア開発スキル",
      displayOrder: 1,
    },
  });

  const catAI = await prisma.skillCategory.upsert({
    where: { name: "AIスキル" },
    update: {},
    create: {
      id: ID.catAI,
      name: "AIスキル",
      description: "機械学習・データサイエンス",
      displayOrder: 2,
    },
  });

  const catBiz = await prisma.skillCategory.upsert({
    where: { name: "ビジネス" },
    update: {},
    create: {
      id: ID.catBiz,
      name: "ビジネス",
      description: "ビジネス・マネジメントスキル",
      displayOrder: 3,
    },
  });

  // スキル（エンジニアリング）
  const skillFE = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catEng.id, name: "フロントエンド" } },
    update: {},
    create: { id: ID.skillFE, categoryId: catEng.id, name: "フロントエンド", displayOrder: 1 },
  });
  const skillBE = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catEng.id, name: "バックエンド" } },
    update: {},
    create: { id: ID.skillBE, categoryId: catEng.id, name: "バックエンド", displayOrder: 2 },
  });
  const skillDB = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catEng.id, name: "DB設計" } },
    update: {},
    create: { id: ID.skillDB, categoryId: catEng.id, name: "DB設計", displayOrder: 3 },
  });

  // スキル（AIスキル）
  const skillML = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catAI.id, name: "機械学習" } },
    update: {},
    create: { id: ID.skillML, categoryId: catAI.id, name: "機械学習", displayOrder: 1 },
  });
  const skillPrompt = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catAI.id, name: "プロンプトエンジニアリング" } },
    update: {},
    create: { id: ID.skillPrompt, categoryId: catAI.id, name: "プロンプトエンジニアリング", displayOrder: 2 },
  });
  const skillRAG = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catAI.id, name: "RAG構築" } },
    update: {},
    create: { id: ID.skillRAG, categoryId: catAI.id, name: "RAG構築", displayOrder: 3 },
  });

  // スキル（ビジネス）
  const skillPM = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catBiz.id, name: "プロジェクト管理" } },
    update: {},
    create: { id: ID.skillPM, categoryId: catBiz.id, name: "プロジェクト管理", displayOrder: 1 },
  });
  const skillSales = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catBiz.id, name: "営業" } },
    update: {},
    create: { id: ID.skillSales, categoryId: catBiz.id, name: "営業", displayOrder: 2 },
  });
  const skillDoc = await prisma.skill.upsert({
    where: { categoryId_name: { categoryId: catBiz.id, name: "ドキュメント作成" } },
    update: {},
    create: { id: ID.skillDoc, categoryId: catBiz.id, name: "ドキュメント作成", displayOrder: 3 },
  });

  console.log("  ✓ 3 skill categories, 9 skills created");

  // ─── スキル評価（追記型：最新 = created_at MAX） ─────────────────────────────
  console.log("  Creating member skill evaluations...");

  const evalDate = new Date("2026-01-15");

  const skillEvals = [
    // 佐藤（admin）
    { memberId: memberSato.id, skillId: skillFE.id, level: 4 },
    { memberId: memberSato.id, skillId: skillBE.id, level: 5 },
    { memberId: memberSato.id, skillId: skillPM.id, level: 5 },
    // 田中（manager）
    { memberId: memberTanaka.id, skillId: skillFE.id, level: 3 },
    { memberId: memberTanaka.id, skillId: skillBE.id, level: 4 },
    { memberId: memberTanaka.id, skillId: skillDB.id, level: 3 },
    { memberId: memberTanaka.id, skillId: skillML.id, level: 3 },
    // 鈴木（employee）
    { memberId: memberSuzuki.id, skillId: skillPrompt.id, level: 4 },
    { memberId: memberSuzuki.id, skillId: skillRAG.id, level: 3 },
    { memberId: memberSuzuki.id, skillId: skillDoc.id, level: 4 },
    // 山田（intern）
    { memberId: memberYamada.id, skillId: skillFE.id, level: 2 },
    { memberId: memberYamada.id, skillId: skillPrompt.id, level: 2 },
  ];

  for (const eval_ of skillEvals) {
    await prisma.memberSkill.create({
      data: {
        memberId: eval_.memberId,
        skillId: eval_.skillId,
        level: eval_.level,
        evaluatedAt: evalDate,
        memo: "初期評価",
        evaluatedBy: ID.userSato,
      },
    });
  }

  console.log(`  ✓ ${skillEvals.length} skill evaluations created`);

  // ─── メンバーツール ──────────────────────────────────────────────────────────
  console.log("  Creating member tools...");

  await prisma.memberTool.createMany({
    data: [
      { memberId: memberSato.id,   toolName: "Claude", plan: "Pro", monthlyCost: 6800, companyLabel: "boost" },
      { memberId: memberSato.id,   toolName: "Notion", plan: "Plus", monthlyCost: 1600, companyLabel: "boost" },
      { memberId: memberTanaka.id, toolName: "Claude", plan: "Pro", monthlyCost: 6800, companyLabel: "boost" },
      { memberId: memberSuzuki.id, toolName: "Claude", plan: "Pro", monthlyCost: 6800, companyLabel: "salt2" },
      { memberId: memberYamada.id, toolName: "Claude", plan: "Pro", monthlyCost: 6800, companyLabel: "boost" },
    ],
  });

  console.log("  ✓ Member tools created");

  // ─── デモ用プロジェクト ─────────────────────────────────────────────────────
  console.log("  Creating demo projects...");

  const project1 = await prisma.project.upsert({
    where: { id: ID.project1 },
    update: {},
    create: {
      id: ID.project1,
      name: "〇〇社AI開発支援",
      description: "LLMを活用した業務効率化システムの開発",
      status: "active",
      company: "boost",
      projectType: "boost_dispatch",
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
      clientName: "株式会社〇〇",
      contractType: "quasi_mandate",
      monthlyContractAmount: 600000,
      createdBy: ID.userSato,
    },
  });

  await prisma.project.upsert({
    where: { id: ID.project2 },
    update: {},
    create: {
      id: ID.project2,
      name: "社内業務管理システム（自社）",
      description: "SALT2の社内業務効率化プロジェクト",
      status: "active",
      company: "salt2",
      projectType: "salt2_own",
      startDate: new Date("2025-10-01"),
      clientName: null,
      contractType: "in_house",
      monthlyContractAmount: 0,
      createdBy: ID.userSato,
    },
  });

  // プロジェクトポジション
  const pos1 = await prisma.projectPosition.create({
    data: {
      projectId: project1.id,
      positionName: "フロントエンドエンジニア",
      requiredCount: 2,
    },
  });

  // アサイン
  await prisma.projectAssignment.create({
    data: {
      projectId: project1.id,
      positionId: pos1.id,
      memberId: memberTanaka.id,
      workloadHours: 80,
      startDate: new Date("2026-01-01"),
      createdBy: ID.userSato,
    },
  });

  console.log("  ✓ 2 demo projects, 1 position, 1 assignment created");

  // ─── 勤務予定（山田・今週分） ────────────────────────────────────────────────
  console.log("  Creating work schedules for Yamada...");

  const weekDates = [
    { date: "2026-02-16", startTime: "10:00", endTime: "19:00", isOff: false },
    { date: "2026-02-17", startTime: "10:00", endTime: "19:00", isOff: false },
    { date: "2026-02-18", startTime: "10:00", endTime: "19:00", isOff: false },
    { date: "2026-02-19", startTime: "10:00", endTime: "19:00", isOff: false },
    { date: "2026-02-20", startTime: "10:00", endTime: "19:00", isOff: false },
    { date: "2026-02-21", startTime: null, endTime: null, isOff: true },
    { date: "2026-02-22", startTime: null, endTime: null, isOff: true },
  ];

  for (const ws of weekDates) {
    await prisma.workSchedule.upsert({
      where: {
        memberId_date: {
          memberId: memberYamada.id,
          date: new Date(ws.date),
        },
      },
      update: {},
      create: {
        memberId: memberYamada.id,
        date: new Date(ws.date),
        startTime: ws.startTime,
        endTime: ws.endTime,
        isOff: ws.isOff,
      },
    });
  }

  console.log("  ✓ Work schedules created");

  // ─── 契約書（デモ） ──────────────────────────────────────────────────────────
  await prisma.memberContract.createMany({
    data: [
      {
        memberId: memberYamada.id,
        status: "completed",
        templateName: "インターン契約書_v2",
        startDate: new Date("2026-01-06"),
        endDate: new Date("2026-03-31"),
        signerEmail: "yamada@example.com",
        completedAt: new Date("2025-12-28"),
        sentAt: new Date("2025-12-25"),
      },
    ],
  });

  console.log("  ✓ Demo contract created");

  console.log("\n✅ Seed complete!");
  console.log("─────────────────────────────────────");
  console.log("ログイン情報（全員: Password123）:");
  console.log("  admin    : sato@example.com");
  console.log("  manager  : tanaka@example.com");
  console.log("  employee : suzuki@example.com");
  console.log("  intern   : yamada@example.com");
  console.log("─────────────────────────────────────");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
