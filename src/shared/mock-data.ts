// =============================================
// Mock Data - 統合業務管理システム デモ用データ
// =============================================

// ---- Types ----

export type Role = "admin" | "manager" | "member";
export type Company = "Boost" | "SALT2";
export type AttendanceStatus = "not_started" | "working" | "break" | "done" | "absent";
export type ProjectStatus = "active" | "completed" | "on_hold";
/** @deprecated 旧クライアント請求書ステータス（給与請求書ワークフローに置き換え済み） */
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

// ---- Payroll Invoice (給与・報酬請求書) ----
export type PayrollInvoiceStatus =
  | "draft"            // 生成前 / 下書き
  | "generated"        // 請求書生成済み
  | "slack_sent"       // Slack DM 送付済み（メンバー確認待ち）
  | "member_approved"  // メンバーが Slack で承認
  | "accounting_sent"  // 経理部門へ送信済み
  | "processed";       // 処理完了

export interface PayrollInvoice {
  id: string;
  invoiceNo: string;
  memberId: string;
  memberName: string;
  company: Company;
  targetMonth: string;   // "2026-02"
  workDays: number;
  totalHours: number;
  hourlyRate: number;
  amount: number;        // 税抜
  taxRate: number;
  taxAmount: number;
  totalAmount: number;   // 税込
  generatedAt?: string;
  slackSentAt?: string;
  approvedAt?: string;
  accountingSentAt?: string;
  status: PayrollInvoiceStatus;
  note?: string;
}

// ---- Monthly Closing Record (月末締め) ----
export type ClosingConfirmStatus =
  | "not_sent"       // Slack 未送信
  | "waiting"        // 確認待ち
  | "confirmed"      // メンバー確認済み
  | "revision"       // 修正依頼中
  | "forced";        // 強制確定

export interface MonthlyClosingRecord {
  memberId: string;
  memberName: string;
  company: Company;
  contractType: "インターン" | "業務委託";
  targetMonth: string;
  workDays: number;
  totalHours: number;
  missingDays: number;
  hourlyRate: number;
  estimatedAmount: number;
  confirmStatus: ClosingConfirmStatus;
  invoiceStatus: "none" | "generated" | "sent" | "approved" | "accounting_sent";
  slackSentAt?: string;
  confirmedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company: Company;
  avatar?: string;
  department: string;
  position: string;
}

export interface Member {
  id: string;
  name: string;
  nameKana: string;
  email: string;
  phone: string;
  role: Role;
  company: Company;
  department: string;
  position: string;
  joinDate: string;
  contractType: "正社員" | "業務委託" | "インターン";
  monthlyRate?: number;
  hourlyRate?: number;
  skills: MemberSkill[];
  tools: MemberTool[];
  contracts: Contract[];
  attendanceStatus: AttendanceStatus;
  slackId?: string;
  memo?: string;
}

export interface MemberSkill {
  skillId: string;
  skillName: string;
  category: string;
  level: 1 | 2 | 3 | 4 | 5;
  selfEval: 1 | 2 | 3 | 4 | 5;
}

export interface MemberTool {
  toolId: string;
  toolName: string;
  category: string;
  proficiency: "初級" | "中級" | "上級";
}

export interface Contract {
  id: string;
  memberId: string;
  startDate: string;
  endDate?: string;
  contractType: "正社員" | "業務委託" | "インターン";
  monthlyRate?: number;
  hourlyRate?: number;
  company: Company;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  company: Company;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budget: number;
  description: string;
  clientName: string;
  pmId: string;
  assignments: ProjectAssignment[];
  monthlyBudget: number;
}

export interface ProjectAssignment {
  memberId: string;
  memberName: string;
  role: string;
  allocationPercent: number;
  monthlyHours: number;
  startDate: string;
  endDate?: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes: number;
  actualHours?: number;
  status: AttendanceStatus;
  workLocation?: "オフィス" | "オンライン";
  projectId?: string;
  todayPlan?: string;
  todayDone?: string;
  tomorrowPlan?: string;
  note?: string;
}

export interface WeeklySchedule {
  memberId: string;
  memberName: string;
  week: {
    date: string;
    dayLabel: string;
    planned?: { start: string; end: string };
    actual?: { start: string; end: string };
    status: "planned" | "actual" | "missing" | "holiday";
    projectName?: string;
  }[];
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  company: Company;
  clientName: string;
  projectId: string;
  projectName: string;
  issueDate: string;
  dueDate: string;
  amount: number;
  tax: number;
  totalAmount: number;
  status: InvoiceStatus;
  items: InvoiceItem[];
}

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export type ProjectType = "boost_dispatch" | "salt2_own";

export interface PLRecord {
  projectId: string;
  projectName: string;
  company: Company;
  projectType: ProjectType;
  month: string;
  revenue: number;
  laborCost: number;
  toolCost: number;
  subcontractCost: number;
  otherCost: number;
  grossProfit: number;
  grossMargin: number;
  markupRate?: number; // boost_dispatch 案件のみ
}

export interface CompanyPLSummary {
  company: Company;
  month: string;
  totalRevenue: number;
  totalLaborCost: number;
  totalToolCost: number;
  totalOtherCost: number;
  totalGrossProfit: number;
  grossMargin: number;
  monthlyTrend: { month: string; revenue: number; grossProfit: number }[];
}

// ---- Demo Users (for login) ----

export const DEMO_USERS: { email: string; password: string; userId: string }[] = [
  { email: "admin@boost.co.jp", password: "password123", userId: "m001" },
  { email: "manager@boost.co.jp", password: "password123", userId: "m002" },
  { email: "member@boost.co.jp", password: "password123", userId: "m003" },
  // 旧アドレスも互換として残す
  { email: "employee@boost.co.jp", password: "password123", userId: "m003" },
  { email: "intern@boost.co.jp", password: "password123", userId: "m006" },
  { email: "admin@salt2.co.jp", password: "password123", userId: "m005" },
];

// ---- Members (8名) ----

export const MEMBERS: Member[] = [
  {
    id: "m001",
    name: "佐藤 健太",
    nameKana: "サトウ ケンタ",
    email: "admin@boost.co.jp",
    phone: "090-1234-5678",
    role: "admin",
    company: "Boost",
    department: "経営管理部",
    position: "代表取締役",
    joinDate: "2020-04-01",
    contractType: "正社員",
    monthlyRate: 600000,
    skills: [
      { skillId: "s001", skillName: "フロントエンド", category: "フロントエンド", level: 5, selfEval: 5 },
      { skillId: "s005", skillName: "ビジネス / マネジメント", category: "ビジネス / マネジメント", level: 5, selfEval: 5 },
      { skillId: "s019", skillName: "コミュニケーション", category: "定性評価", level: 5, selfEval: 5 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 5, selfEval: 5 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t002", toolName: "Notion", category: "ドキュメント", proficiency: "上級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "上級" },
    ],
    contracts: [
      {
        id: "c001",
        memberId: "m001",
        startDate: "2020-04-01",
        contractType: "正社員",
        monthlyRate: 600000,
        company: "Boost",
      },
    ],
    attendanceStatus: "working",
    slackId: "U001SATO",
    memo: "会社創業者。全社PL管理を担当。",
  },
  {
    id: "m002",
    name: "田中 翔太",
    nameKana: "タナカ ショウタ",
    email: "manager@boost.co.jp",
    phone: "090-2345-6789",
    role: "manager",
    company: "Boost",
    department: "開発部",
    position: "プロジェクトマネージャー",
    joinDate: "2021-07-01",
    contractType: "正社員",
    monthlyRate: 480000,
    skills: [
      { skillId: "s001", skillName: "フロントエンド", category: "フロントエンド", level: 4, selfEval: 4 },
      { skillId: "s003", skillName: "バックエンド", category: "バックエンド", level: 4, selfEval: 4 },
      { skillId: "s005", skillName: "ビジネス / マネジメント", category: "ビジネス / マネジメント", level: 4, selfEval: 3 },
      { skillId: "s019", skillName: "コミュニケーション", category: "定性評価", level: 4, selfEval: 4 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 4, selfEval: 3 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "上級" },
      { toolId: "t004", toolName: "Jira", category: "プロジェクト管理", proficiency: "中級" },
    ],
    contracts: [
      {
        id: "c002",
        memberId: "m002",
        startDate: "2021-07-01",
        contractType: "正社員",
        monthlyRate: 480000,
        company: "Boost",
      },
    ],
    attendanceStatus: "break",
    slackId: "U002TANAKA",
  },
  {
    id: "m003",
    name: "鈴木 美咲",
    nameKana: "スズキ ミサキ",
    email: "employee@boost.co.jp",
    phone: "090-3456-7890",
    role: "member",
    company: "Boost",
    department: "開発部",
    position: "フロントエンドエンジニア",
    joinDate: "2022-04-01",
    contractType: "正社員",
    monthlyRate: 380000,
    skills: [
      { skillId: "s001", skillName: "フロントエンド", category: "フロントエンド", level: 4, selfEval: 4 },
      { skillId: "s018", skillName: "アピアランス", category: "定性評価", level: 4, selfEval: 4 },
      { skillId: "s019", skillName: "コミュニケーション", category: "定性評価", level: 4, selfEval: 3 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "上級" },
      { toolId: "t005", toolName: "Figma", category: "デザイン", proficiency: "中級" },
    ],
    contracts: [
      {
        id: "c003",
        memberId: "m003",
        startDate: "2022-04-01",
        contractType: "正社員",
        monthlyRate: 380000,
        company: "Boost",
      },
    ],
    attendanceStatus: "working",
    slackId: "U003SUZUKI",
  },
  {
    id: "m004",
    name: "山田 大樹",
    nameKana: "ヤマダ ダイキ",
    email: "yamada@boost.co.jp",
    phone: "090-4567-8901",
    role: "member",
    company: "Boost",
    department: "開発部",
    position: "バックエンドエンジニア",
    joinDate: "2022-10-01",
    contractType: "正社員",
    monthlyRate: 400000,
    skills: [
      { skillId: "s003", skillName: "バックエンド", category: "バックエンド", level: 4, selfEval: 4 },
      { skillId: "s004", skillName: "インフラ / クラウド", category: "インフラ / クラウド", level: 3, selfEval: 3 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 3, selfEval: 3 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "上級" },
      { toolId: "t006", toolName: "AWS", category: "クラウド", proficiency: "中級" },
    ],
    contracts: [
      {
        id: "c004",
        memberId: "m004",
        startDate: "2022-10-01",
        contractType: "正社員",
        monthlyRate: 400000,
        company: "Boost",
      },
    ],
    attendanceStatus: "not_started",
    slackId: "U004YAMADA",
  },
  {
    id: "m005",
    name: "中村 由美",
    nameKana: "ナカムラ ユミ",
    email: "admin@salt2.co.jp",
    phone: "090-5678-9012",
    role: "admin",
    company: "SALT2",
    department: "経営管理部",
    position: "取締役",
    joinDate: "2020-07-01",
    contractType: "正社員",
    monthlyRate: 550000,
    skills: [
      { skillId: "s005", skillName: "ビジネス / マネジメント", category: "ビジネス / マネジメント", level: 5, selfEval: 5 },
      { skillId: "s019", skillName: "コミュニケーション", category: "定性評価", level: 5, selfEval: 4 },
      { skillId: "s017", skillName: "コミットメント量", category: "定性評価", level: 4, selfEval: 4 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t002", toolName: "Notion", category: "ドキュメント", proficiency: "上級" },
      { toolId: "t007", toolName: "freee", category: "会計", proficiency: "上級" },
    ],
    contracts: [
      {
        id: "c005",
        memberId: "m005",
        startDate: "2020-07-01",
        contractType: "正社員",
        monthlyRate: 550000,
        company: "SALT2",
      },
    ],
    attendanceStatus: "done",
    slackId: "U005NAKAMURA",
  },
  {
    id: "m006",
    name: "小林 蓮",
    nameKana: "コバヤシ レン",
    email: "intern@boost.co.jp",
    phone: "080-6789-0123",
    role: "member",
    company: "Boost",
    department: "開発部",
    position: "インターン（フロントエンド）",
    joinDate: "2024-04-01",
    contractType: "インターン",
    hourlyRate: 1200,
    skills: [
      { skillId: "s001", skillName: "フロントエンド", category: "フロントエンド", level: 2, selfEval: 2 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 4, selfEval: 5 },
      { skillId: "s017", skillName: "コミットメント量", category: "定性評価", level: 3, selfEval: 4 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "中級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "初級" },
    ],
    contracts: [
      {
        id: "c006",
        memberId: "m006",
        startDate: "2024-04-01",
        endDate: "2025-03-31",
        contractType: "インターン",
        hourlyRate: 1200,
        company: "Boost",
      },
    ],
    attendanceStatus: "working",
    slackId: "U006KOBAYASHI",
  },
  {
    id: "m007",
    name: "伊藤 さくら",
    nameKana: "イトウ サクラ",
    email: "ito@boost.co.jp",
    phone: "080-7890-1234",
    role: "member",
    company: "Boost",
    department: "開発部",
    position: "インターン（バックエンド）",
    joinDate: "2024-06-01",
    contractType: "インターン",
    hourlyRate: 1200,
    skills: [
      { skillId: "s003", skillName: "バックエンド", category: "バックエンド", level: 2, selfEval: 1 },
      { skillId: "s004", skillName: "インフラ / クラウド", category: "インフラ / クラウド", level: 1, selfEval: 1 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 3, selfEval: 3 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "中級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "初級" },
    ],
    contracts: [
      {
        id: "c007",
        memberId: "m007",
        startDate: "2024-06-01",
        endDate: "2025-05-31",
        contractType: "インターン",
        hourlyRate: 1200,
        company: "Boost",
      },
    ],
    attendanceStatus: "not_started",
    slackId: "U007ITO",
  },
  {
    id: "m008",
    name: "渡辺 翔",
    nameKana: "ワタナベ ショウ",
    email: "watanabe@salt2.co.jp",
    phone: "090-8901-2345",
    role: "member",
    company: "SALT2",
    department: "開発部",
    position: "フルスタックエンジニア",
    joinDate: "2023-01-01",
    contractType: "業務委託",
    hourlyRate: 5000,
    skills: [
      { skillId: "s001", skillName: "フロントエンド", category: "フロントエンド", level: 4, selfEval: 4 },
      { skillId: "s003", skillName: "バックエンド", category: "バックエンド", level: 4, selfEval: 4 },
      { skillId: "s004", skillName: "インフラ / クラウド", category: "インフラ / クラウド", level: 4, selfEval: 4 },
      { skillId: "s016", skillName: "熱意", category: "定性評価", level: 4, selfEval: 4 },
    ],
    tools: [
      { toolId: "t001", toolName: "Slack", category: "コミュニケーション", proficiency: "上級" },
      { toolId: "t003", toolName: "GitHub", category: "開発", proficiency: "上級" },
      { toolId: "t006", toolName: "AWS", category: "クラウド", proficiency: "上級" },
    ],
    contracts: [
      {
        id: "c008",
        memberId: "m008",
        startDate: "2023-01-01",
        contractType: "業務委託",
        hourlyRate: 5000,
        company: "SALT2",
      },
    ],
    attendanceStatus: "working",
    slackId: "U008WATANABE",
  },
];

// ---- SALT2 擬似メンバー（会社名義ツール管理用） ----
// AWS など会社名義の SaaS は、このエントリをオーナーとして MEMBER_TOOL に登録する
export const SALT2_COMPANY_MEMBER: Member = {
  id: "mSALT2",
  name: "SALT2（会社）",
  nameKana: "ソルツツー カイシャ",
  email: "system@salt2.co.jp",
  phone: "",
  role: "admin",
  company: "SALT2",
  department: "会社共通",
  position: "法人アカウント",
  joinDate: "2020-01-01",
  contractType: "正社員",
  skills: [],
  tools: [],
  contracts: [],
  attendanceStatus: "not_started",
};

// ---- Projects (4件) ----

export const PROJECTS: Project[] = [
  {
    id: "p001",
    name: "新規SaaS開発プロジェクト",
    code: "PRJ-2024-001",
    company: "Boost",
    status: "active",
    startDate: "2024-04-01",
    budget: 8000000,
    description: "中小企業向け勤怠・プロジェクト管理SaaSの新規開発。フロントエンド中心に3名体制で進行中。",
    clientName: "自社開発",
    pmId: "m002",
    monthlyBudget: 1200000,
    assignments: [
      { memberId: "m002", memberName: "田中 翔太", role: "PM", allocationPercent: 30, monthlyHours: 48, startDate: "2024-04-01" },
      { memberId: "m003", memberName: "鈴木 美咲", role: "フロントエンド", allocationPercent: 80, monthlyHours: 128, startDate: "2024-04-01" },
      { memberId: "m006", memberName: "小林 蓮", role: "フロントエンド（サポート）", allocationPercent: 50, monthlyHours: 80, startDate: "2024-06-01" },
    ],
  },
  {
    id: "p002",
    name: "基幹システム移行支援",
    code: "PRJ-2024-002",
    company: "Boost",
    status: "active",
    startDate: "2024-01-15",
    budget: 5000000,
    description: "製造業クライアントの基幹システムをクラウドへ移行する支援業務。バックエンド・インフラ中心。",
    clientName: "株式会社テックファクトリー",
    pmId: "m002",
    monthlyBudget: 800000,
    assignments: [
      { memberId: "m002", memberName: "田中 翔太", role: "PM", allocationPercent: 40, monthlyHours: 64, startDate: "2024-01-15" },
      { memberId: "m004", memberName: "山田 大樹", role: "バックエンド", allocationPercent: 70, monthlyHours: 112, startDate: "2024-01-15" },
      { memberId: "m007", memberName: "伊藤 さくら", role: "バックエンド（サポート）", allocationPercent: 30, monthlyHours: 48, startDate: "2024-07-01" },
    ],
  },
  {
    id: "p003",
    name: "EC分析ダッシュボード開発",
    code: "PRJ-2024-003",
    company: "SALT2",
    status: "active",
    startDate: "2024-05-01",
    budget: 3500000,
    description: "ECサイト向けリアルタイム分析ダッシュボードの開発。フルスタック1名で担当。",
    clientName: "SALT2 自社案件",
    pmId: "m005",
    monthlyBudget: 700000,
    assignments: [
      { memberId: "m005", memberName: "中村 由美", role: "PM", allocationPercent: 20, monthlyHours: 32, startDate: "2024-05-01" },
      { memberId: "m008", memberName: "渡辺 翔", role: "フルスタック", allocationPercent: 80, monthlyHours: 128, startDate: "2024-05-01" },
    ],
  },
  {
    id: "p004",
    name: "社内業務効率化ツール",
    code: "PRJ-2024-004",
    company: "SALT2",
    status: "on_hold",
    startDate: "2024-07-01",
    budget: 1500000,
    description: "SALT2社内の業務フロー自動化ツール。現在一時停止中。",
    clientName: "SALT2 内部",
    pmId: "m005",
    monthlyBudget: 300000,
    assignments: [
      { memberId: "m005", memberName: "中村 由美", role: "PM", allocationPercent: 10, monthlyHours: 16, startDate: "2024-07-01" },
      { memberId: "m008", memberName: "渡辺 翔", role: "開発", allocationPercent: 20, monthlyHours: 32, startDate: "2024-07-01" },
    ],
  },
];

// ---- Weekly Schedule ----

export const WEEKLY_SCHEDULES: WeeklySchedule[] = [
  {
    memberId: "m001",
    memberName: "佐藤 健太",
    week: [
      { date: "2026-02-16", dayLabel: "月", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:10", end: "18:30" }, status: "actual", projectName: "社内業務" },
      { date: "2026-02-17", dayLabel: "火", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:05", end: "19:00" }, status: "actual", projectName: "社内業務" },
      { date: "2026-02-18", dayLabel: "水", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:00", end: "18:15" }, status: "actual", projectName: "社内業務" },
      { date: "2026-02-19", dayLabel: "木", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:15", end: "18:00" }, status: "actual", projectName: "社内業務" },
      { date: "2026-02-20", dayLabel: "金", planned: { start: "09:00", end: "18:00" }, status: "planned", projectName: "社内業務" },
      { date: "2026-02-21", dayLabel: "土", status: "holiday" },
      { date: "2026-02-22", dayLabel: "日", status: "holiday" },
    ],
  },
  {
    memberId: "m002",
    memberName: "田中 翔太",
    week: [
      { date: "2026-02-16", dayLabel: "月", planned: { start: "10:00", end: "19:00" }, actual: { start: "10:05", end: "19:30" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-17", dayLabel: "火", planned: { start: "10:00", end: "19:00" }, actual: { start: "10:00", end: "18:45" }, status: "actual", projectName: "基幹移行" },
      { date: "2026-02-18", dayLabel: "水", planned: { start: "10:00", end: "19:00" }, status: "missing", projectName: "新規SaaS" },
      { date: "2026-02-19", dayLabel: "木", planned: { start: "10:00", end: "19:00" }, actual: { start: "10:15", end: "19:00" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-20", dayLabel: "金", planned: { start: "10:00", end: "19:00" }, status: "planned", projectName: "基幹移行" },
      { date: "2026-02-21", dayLabel: "土", status: "holiday" },
      { date: "2026-02-22", dayLabel: "日", status: "holiday" },
    ],
  },
  {
    memberId: "m003",
    memberName: "鈴木 美咲",
    week: [
      { date: "2026-02-16", dayLabel: "月", planned: { start: "09:30", end: "18:30" }, actual: { start: "09:30", end: "18:30" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-17", dayLabel: "火", planned: { start: "09:30", end: "18:30" }, actual: { start: "09:45", end: "18:30" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-18", dayLabel: "水", planned: { start: "09:30", end: "18:30" }, actual: { start: "09:30", end: "18:00" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-19", dayLabel: "木", planned: { start: "09:30", end: "18:30" }, actual: { start: "09:30", end: "19:30" }, status: "actual", projectName: "新規SaaS" },
      { date: "2026-02-20", dayLabel: "金", planned: { start: "09:30", end: "18:30" }, status: "planned", projectName: "新規SaaS" },
      { date: "2026-02-21", dayLabel: "土", status: "holiday" },
      { date: "2026-02-22", dayLabel: "日", status: "holiday" },
    ],
  },
  {
    memberId: "m004",
    memberName: "山田 大樹",
    week: [
      { date: "2026-02-16", dayLabel: "月", planned: { start: "09:00", end: "18:00" }, status: "missing", projectName: "基幹移行" },
      { date: "2026-02-17", dayLabel: "火", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:10", end: "18:30" }, status: "actual", projectName: "基幹移行" },
      { date: "2026-02-18", dayLabel: "水", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:00", end: "18:00" }, status: "actual", projectName: "基幹移行" },
      { date: "2026-02-19", dayLabel: "木", planned: { start: "09:00", end: "18:00" }, actual: { start: "09:20", end: "17:45" }, status: "actual", projectName: "基幹移行" },
      { date: "2026-02-20", dayLabel: "金", planned: { start: "09:00", end: "18:00" }, status: "planned", projectName: "基幹移行" },
      { date: "2026-02-21", dayLabel: "土", status: "holiday" },
      { date: "2026-02-22", dayLabel: "日", status: "holiday" },
    ],
  },
];

// ---- Attendance Records ----

export const ATTENDANCE_RECORDS: AttendanceRecord[] = [
  { id: "a001", memberId: "m001", memberName: "佐藤 健太", date: "2026-02-20", clockIn: "09:10", breakMinutes: 60, status: "working", workLocation: "オフィス", projectId: "p001", todayPlan: "PL確認・経営会議の準備" },
  { id: "a002", memberId: "m002", memberName: "田中 翔太", date: "2026-02-20", clockIn: "10:05", breakMinutes: 60, status: "break", workLocation: "オンライン", projectId: "p001", todayPlan: "SaaS開発のスプリントレビュー準備" },
  { id: "a003", memberId: "m003", memberName: "鈴木 美咲", date: "2026-02-20", clockIn: "09:30", breakMinutes: 45, status: "working", workLocation: "オフィス", projectId: "p001", todayPlan: "ダッシュボードUIの実装" },
  { id: "a004", memberId: "m004", memberName: "山田 大樹", date: "2026-02-20", breakMinutes: 0, status: "not_started" },
  { id: "a005", memberId: "m005", memberName: "中村 由美", date: "2026-02-20", clockIn: "09:00", clockOut: "17:30", breakMinutes: 60, actualHours: 7.5, status: "done", workLocation: "オフィス", projectId: "p003", todayDone: "月次締め処理の確認完了", tomorrowPlan: "経費精算レビュー" },
  { id: "a006", memberId: "m006", memberName: "小林 蓮", date: "2026-02-20", clockIn: "13:00", breakMinutes: 0, status: "working", workLocation: "オンライン", projectId: "p001", todayPlan: "コンポーネントのテスト作成" },
  { id: "a007", memberId: "m007", memberName: "伊藤 さくら", date: "2026-02-20", breakMinutes: 0, status: "not_started" },
  { id: "a008", memberId: "m008", memberName: "渡辺 翔", date: "2026-02-20", clockIn: "10:00", breakMinutes: 60, status: "working", workLocation: "オンライン", projectId: "p003", todayPlan: "APIエンドポイントの実装" },
];

// ---- Payroll Invoices (給与・報酬請求書データ) ----
// 対象: 時給制メンバー（インターン m006,m007 / 業務委託 m008）

export const PAYROLL_INVOICES: PayrollInvoice[] = [
  // 2026-02（当月）
  {
    id: "pi001", invoiceNo: "PAY-2026-02-001",
    memberId: "m006", memberName: "小林 蓮", company: "Boost",
    targetMonth: "2026-02", workDays: 15, totalHours: 60,
    hourlyRate: 1200, amount: 72000, taxRate: 0.1, taxAmount: 7200, totalAmount: 79200,
    generatedAt: "2026-02-18T10:00:00Z",
    slackSentAt: "2026-02-18T10:05:00Z",
    status: "slack_sent",
    note: "新規SaaS開発プロジェクト稼働分",
  },
  {
    id: "pi002", invoiceNo: "PAY-2026-02-002",
    memberId: "m007", memberName: "伊藤 さくら", company: "Boost",
    targetMonth: "2026-02", workDays: 12, totalHours: 48,
    hourlyRate: 1200, amount: 57600, taxRate: 0.1, taxAmount: 5760, totalAmount: 63360,
    generatedAt: "2026-02-18T10:00:00Z",
    slackSentAt: "2026-02-18T10:05:00Z",
    approvedAt: "2026-02-18T14:30:00Z",
    status: "member_approved",
    note: "基幹システム移行支援稼働分",
  },
  {
    id: "pi003", invoiceNo: "PAY-2026-02-003",
    memberId: "m008", memberName: "渡辺 翔", company: "SALT2",
    targetMonth: "2026-02", workDays: 18, totalHours: 144,
    hourlyRate: 5000, amount: 720000, taxRate: 0.1, taxAmount: 72000, totalAmount: 792000,
    generatedAt: "2026-02-17T09:00:00Z",
    slackSentAt: "2026-02-17T09:05:00Z",
    approvedAt: "2026-02-17T11:00:00Z",
    accountingSentAt: "2026-02-17T11:30:00Z",
    status: "accounting_sent",
    note: "EC分析ダッシュボード開発稼働分",
  },
  // 2026-01（前月・完了済み）
  {
    id: "pi004", invoiceNo: "PAY-2026-01-001",
    memberId: "m006", memberName: "小林 蓮", company: "Boost",
    targetMonth: "2026-01", workDays: 16, totalHours: 64,
    hourlyRate: 1200, amount: 76800, taxRate: 0.1, taxAmount: 7680, totalAmount: 84480,
    generatedAt: "2026-01-20T10:00:00Z",
    slackSentAt: "2026-01-20T10:05:00Z",
    approvedAt: "2026-01-20T15:00:00Z",
    accountingSentAt: "2026-01-21T09:00:00Z",
    status: "processed",
  },
  {
    id: "pi005", invoiceNo: "PAY-2026-01-002",
    memberId: "m007", memberName: "伊藤 さくら", company: "Boost",
    targetMonth: "2026-01", workDays: 10, totalHours: 40,
    hourlyRate: 1200, amount: 48000, taxRate: 0.1, taxAmount: 4800, totalAmount: 52800,
    generatedAt: "2026-01-20T10:00:00Z",
    slackSentAt: "2026-01-20T10:05:00Z",
    approvedAt: "2026-01-20T16:00:00Z",
    accountingSentAt: "2026-01-21T09:00:00Z",
    status: "processed",
  },
  {
    id: "pi006", invoiceNo: "PAY-2026-01-003",
    memberId: "m008", memberName: "渡辺 翔", company: "SALT2",
    targetMonth: "2026-01", workDays: 20, totalHours: 160,
    hourlyRate: 5000, amount: 800000, taxRate: 0.1, taxAmount: 80000, totalAmount: 880000,
    generatedAt: "2026-01-18T09:00:00Z",
    slackSentAt: "2026-01-18T09:05:00Z",
    approvedAt: "2026-01-18T11:00:00Z",
    accountingSentAt: "2026-01-19T09:00:00Z",
    status: "processed",
  },
];

// ---- Monthly Closing Records (月末締め管理) ----

export const MONTHLY_CLOSING: MonthlyClosingRecord[] = [
  {
    memberId: "m006", memberName: "小林 蓮", company: "Boost",
    contractType: "インターン", targetMonth: "2026-02",
    workDays: 15, totalHours: 60, missingDays: 0, hourlyRate: 1200,
    estimatedAmount: 72000, confirmStatus: "waiting",
    invoiceStatus: "sent", slackSentAt: "2026-02-18T10:05:00Z",
  },
  {
    memberId: "m007", memberName: "伊藤 さくら", company: "Boost",
    contractType: "インターン", targetMonth: "2026-02",
    workDays: 12, totalHours: 48, missingDays: 1, hourlyRate: 1200,
    estimatedAmount: 57600, confirmStatus: "confirmed",
    invoiceStatus: "approved", slackSentAt: "2026-02-18T10:05:00Z", confirmedAt: "2026-02-18T14:30:00Z",
  },
  {
    memberId: "m008", memberName: "渡辺 翔", company: "SALT2",
    contractType: "業務委託", targetMonth: "2026-02",
    workDays: 18, totalHours: 144, missingDays: 0, hourlyRate: 5000,
    estimatedAmount: 720000, confirmStatus: "confirmed",
    invoiceStatus: "accounting_sent", slackSentAt: "2026-02-17T09:05:00Z", confirmedAt: "2026-02-17T11:00:00Z",
  },
];

export function getPayrollInvoiceStatusLabel(status: PayrollInvoiceStatus): string {
  const labels: Record<PayrollInvoiceStatus, string> = {
    draft: "下書き",
    generated: "生成済み",
    slack_sent: "Slack送付済",
    member_approved: "メンバー承認済",
    accounting_sent: "経理送信済",
    processed: "処理完了",
  };
  return labels[status];
}

export function getClosingConfirmStatusLabel(status: ClosingConfirmStatus): string {
  const labels: Record<ClosingConfirmStatus, string> = {
    not_sent: "未送信",
    waiting: "確認待ち",
    confirmed: "確認済み",
    revision: "修正依頼中",
    forced: "強制確定",
  };
  return labels[status];
}

// ---- (旧) Client Invoices - 後方互換のため残存 ----

export const INVOICES: Invoice[] = [
  {
    id: "inv001",
    invoiceNo: "INV-2026-001",
    company: "Boost",
    clientName: "株式会社テックファクトリー",
    projectId: "p002",
    projectName: "基幹システム移行支援",
    issueDate: "2026-02-01",
    dueDate: "2026-02-28",
    amount: 800000,
    tax: 80000,
    totalAmount: 880000,
    status: "sent",
    items: [
      { description: "システム移行支援作業（2026年1月分）", quantity: 1, unitPrice: 700000, amount: 700000 },
      { description: "インフラ設定費用", quantity: 1, unitPrice: 100000, amount: 100000 },
    ],
  },
  {
    id: "inv002",
    invoiceNo: "INV-2026-002",
    company: "Boost",
    clientName: "自社開発",
    projectId: "p001",
    projectName: "新規SaaS開発",
    issueDate: "2026-02-01",
    dueDate: "2026-02-28",
    amount: 1200000,
    tax: 120000,
    totalAmount: 1320000,
    status: "draft",
    items: [
      { description: "開発作業費（2026年1月分）", quantity: 1, unitPrice: 1200000, amount: 1200000 },
    ],
  },
  {
    id: "inv003",
    invoiceNo: "INV-2026-003",
    company: "SALT2",
    clientName: "株式会社オンラインマーケット",
    projectId: "p003",
    projectName: "EC分析ダッシュボード開発",
    issueDate: "2026-01-31",
    dueDate: "2026-02-28",
    amount: 700000,
    tax: 70000,
    totalAmount: 770000,
    status: "paid",
    items: [
      { description: "EC分析ダッシュボード開発（2026年1月分）", quantity: 1, unitPrice: 700000, amount: 700000 },
    ],
  },
  {
    id: "inv004",
    invoiceNo: "INV-2026-004",
    company: "Boost",
    clientName: "株式会社テックファクトリー",
    projectId: "p002",
    projectName: "基幹システム移行支援",
    issueDate: "2026-01-05",
    dueDate: "2026-01-31",
    amount: 800000,
    tax: 80000,
    totalAmount: 880000,
    status: "paid",
    items: [
      { description: "システム移行支援作業（2025年12月分）", quantity: 1, unitPrice: 800000, amount: 800000 },
    ],
  },
  {
    id: "inv005",
    invoiceNo: "INV-2026-005",
    company: "SALT2",
    clientName: "株式会社オンラインマーケット",
    projectId: "p003",
    projectName: "EC分析ダッシュボード開発",
    issueDate: "2025-12-31",
    dueDate: "2026-01-31",
    amount: 700000,
    tax: 70000,
    totalAmount: 770000,
    status: "overdue",
    items: [
      { description: "EC分析ダッシュボード開発（2025年12月分）", quantity: 1, unitPrice: 700000, amount: 700000 },
    ],
  },
  {
    id: "inv006",
    invoiceNo: "INV-2026-006",
    company: "Boost",
    clientName: "株式会社デジタルソリューションズ",
    projectId: "p001",
    projectName: "新規SaaS開発",
    issueDate: "2026-02-15",
    dueDate: "2026-03-15",
    amount: 500000,
    tax: 50000,
    totalAmount: 550000,
    status: "sent",
    items: [
      { description: "コンサルティング費用", quantity: 1, unitPrice: 300000, amount: 300000 },
      { description: "設計支援作業", quantity: 40, unitPrice: 5000, amount: 200000 },
    ],
  },
];

// ---- PL Records ----
// boost_dispatch: revenue = laborCost × markupRate(1.20) + toolCost
// salt2_own: revenue = 契約金額（手動入力）

export const PL_RECORDS: PLRecord[] = [
  // 2026-02
  // p001: Boost派遣案件 → revenue = 780000×1.20 + 50000 = 986000
  { projectId: "p001", projectName: "新規SaaS開発", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2026-02", revenue: 986000, laborCost: 780000, toolCost: 50000, subcontractCost: 0, otherCost: 20000, grossProfit: 136000, grossMargin: 13.8 },
  // p002: Boost派遣案件 → revenue = 480000×1.20 + 30000 = 606000
  { projectId: "p002", projectName: "基幹システム移行", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2026-02", revenue: 606000, laborCost: 480000, toolCost: 30000, subcontractCost: 0, otherCost: 10000, grossProfit: 86000, grossMargin: 14.2 },
  // p003: SALT2自社案件 → revenue = 契約金額
  { projectId: "p003", projectName: "EC分析ダッシュボード", company: "SALT2", projectType: "salt2_own", month: "2026-02", revenue: 700000, laborCost: 400000, toolCost: 20000, subcontractCost: 0, otherCost: 5000, grossProfit: 275000, grossMargin: 39.3 },
  { projectId: "p004", projectName: "社内業務効率化ツール", company: "SALT2", projectType: "salt2_own", month: "2026-02", revenue: 0, laborCost: 0, toolCost: 5000, subcontractCost: 0, otherCost: 0, grossProfit: -5000, grossMargin: 0 },
  // 2026-01
  { projectId: "p001", projectName: "新規SaaS開発", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2026-01", revenue: 986000, laborCost: 780000, toolCost: 50000, subcontractCost: 0, otherCost: 20000, grossProfit: 136000, grossMargin: 13.8 },
  { projectId: "p002", projectName: "基幹システム移行", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2026-01", revenue: 606000, laborCost: 480000, toolCost: 30000, subcontractCost: 0, otherCost: 10000, grossProfit: 86000, grossMargin: 14.2 },
  { projectId: "p003", projectName: "EC分析ダッシュボード", company: "SALT2", projectType: "salt2_own", month: "2026-01", revenue: 700000, laborCost: 400000, toolCost: 20000, subcontractCost: 0, otherCost: 5000, grossProfit: 275000, grossMargin: 39.3 },
  // 2025-12
  { projectId: "p001", projectName: "新規SaaS開発", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2025-12", revenue: 950000, laborCost: 750000, toolCost: 50000, subcontractCost: 0, otherCost: 20000, grossProfit: 130000, grossMargin: 13.7 },
  { projectId: "p002", projectName: "基幹システム移行", company: "Boost", projectType: "boost_dispatch", markupRate: 1.20, month: "2025-12", revenue: 606000, laborCost: 480000, toolCost: 30000, subcontractCost: 0, otherCost: 10000, grossProfit: 86000, grossMargin: 14.2 },
  { projectId: "p003", projectName: "EC分析ダッシュボード", company: "SALT2", projectType: "salt2_own", month: "2025-12", revenue: 700000, laborCost: 400000, toolCost: 20000, subcontractCost: 0, otherCost: 5000, grossProfit: 275000, grossMargin: 39.3 },
];

// ---- Company PL Summary Trend ----

export const COMPANY_PL_TREND: { company: Company; month: string; revenue: number; grossProfit: number; laborCost: number }[] = [
  { company: "Boost", month: "2025-09", revenue: 1800000, grossProfit: 480000, laborCost: 1250000 },
  { company: "Boost", month: "2025-10", revenue: 1900000, grossProfit: 530000, laborCost: 1280000 },
  { company: "Boost", month: "2025-11", revenue: 2000000, grossProfit: 560000, laborCost: 1300000 },
  { company: "Boost", month: "2025-12", revenue: 1900000, grossProfit: 560000, laborCost: 1230000 },
  { company: "Boost", month: "2026-01", revenue: 2000000, grossProfit: 630000, laborCost: 1260000 },
  { company: "Boost", month: "2026-02", revenue: 2000000, grossProfit: 630000, laborCost: 1260000 },
  { company: "SALT2", month: "2025-09", revenue: 600000, grossProfit: 220000, laborCost: 360000 },
  { company: "SALT2", month: "2025-10", revenue: 650000, grossProfit: 250000, laborCost: 370000 },
  { company: "SALT2", month: "2025-11", revenue: 680000, grossProfit: 260000, laborCost: 390000 },
  { company: "SALT2", month: "2025-12", revenue: 700000, grossProfit: 275000, laborCost: 400000 },
  { company: "SALT2", month: "2026-01", revenue: 700000, grossProfit: 275000, laborCost: 400000 },
  { company: "SALT2", month: "2026-02", revenue: 700000, grossProfit: 270000, laborCost: 405000 },
];

// ---- Skill Master ----

export const SKILL_CATEGORIES = [
  {
    id: "cat001",
    name: "フロントエンド",
    description: "フロントエンド開発全般",
    skills: [
      { id: "s001", name: "フロントエンド" },
    ],
  },
  {
    id: "cat002",
    name: "バックエンド",
    description: "バックエンド開発全般",
    skills: [
      { id: "s003", name: "バックエンド" },
    ],
  },
  {
    id: "cat003",
    name: "インフラ / クラウド",
    description: "DB, コンテナ, クラウドインフラ全般",
    skills: [
      { id: "s004", name: "インフラ / クラウド" },
    ],
  },
  {
    id: "cat004",
    name: "ビジネス / マネジメント",
    description: "PM, 提案, 財務などのビジネス系スキル",
    skills: [
      { id: "s005", name: "ビジネス / マネジメント" },
    ],
  },
  {
    id: "cat005",
    name: "定性評価",
    description: "熱意・コミュニケーション力など数値化しにくい資質の評価",
    skills: [
      { id: "s016", name: "熱意" },
      { id: "s017", name: "コミットメント量" },
      { id: "s018", name: "アピアランス" },
      { id: "s019", name: "コミュニケーション" },
    ],
  },
];

// ---- Tool Master ----

export const TOOL_CATEGORIES = [
  {
    id: "tcat001",
    name: "コミュニケーション",
    tools: [{ id: "t001", name: "Slack" }, { id: "t014", name: "Zoom" }],
  },
  {
    id: "tcat002",
    name: "ドキュメント / 設計",
    tools: [{ id: "t002", name: "Notion" }, { id: "t005", name: "Figma" }],
  },
  {
    id: "tcat003",
    name: "開発 / インフラ",
    tools: [{ id: "t003", name: "GitHub" }, { id: "t006", name: "AWS" }],
  },
  {
    id: "tcat004",
    name: "プロジェクト管理",
    tools: [{ id: "t004", name: "Jira" }, { id: "t015", name: "Asana" }],
  },
  {
    id: "tcat005",
    name: "会計 / 業務",
    tools: [{ id: "t007", name: "freee" }],
  },
];

// ---- SaaS Tool Subscriptions (MEMBER_TOOL entity) ----

export type ContractStatus = "draft" | "sent" | "waiting_sign" | "completed" | "voided";

export interface SaasTool {
  id: string;
  memberId: string;
  memberName: string;
  toolName: string;
  plan: string;
  monthlyCost: number;
  companyLabel: Company;
  note?: string;
  updatedAt: string;
}

export const SAAS_TOOLS: SaasTool[] = [
  // Boost メンバー
  { id: "st001", memberId: "m001", memberName: "佐藤 健太", toolName: "Claude", plan: "Max", monthlyCost: 20000, companyLabel: "Boost", note: "全社AI活用", updatedAt: "2026-02-01" },
  { id: "st002", memberId: "m001", memberName: "佐藤 健太", toolName: "Notion", plan: "Business", monthlyCost: 2400, companyLabel: "Boost", updatedAt: "2026-01-15" },
  { id: "st003", memberId: "m001", memberName: "佐藤 健太", toolName: "GitHub", plan: "Team", monthlyCost: 1500, companyLabel: "Boost", updatedAt: "2026-01-15" },
  { id: "st004", memberId: "m002", memberName: "田中 翔太", toolName: "Claude", plan: "Pro", monthlyCost: 3200, companyLabel: "Boost", updatedAt: "2026-02-01" },
  { id: "st005", memberId: "m002", memberName: "田中 翔太", toolName: "GitHub", plan: "Team", monthlyCost: 1500, companyLabel: "Boost", updatedAt: "2026-01-15" },
  { id: "st006", memberId: "m002", memberName: "田中 翔太", toolName: "Jira", plan: "Standard", monthlyCost: 1200, companyLabel: "Boost", updatedAt: "2025-12-01" },
  { id: "st007", memberId: "m003", memberName: "鈴木 美咲", toolName: "Claude", plan: "Pro", monthlyCost: 3200, companyLabel: "Boost", updatedAt: "2026-02-01" },
  { id: "st008", memberId: "m003", memberName: "鈴木 美咲", toolName: "Figma", plan: "Professional", monthlyCost: 3600, companyLabel: "Boost", note: "UI設計用", updatedAt: "2026-01-10" },
  { id: "st009", memberId: "m003", memberName: "鈴木 美咲", toolName: "GitHub", plan: "Team", monthlyCost: 1500, companyLabel: "Boost", updatedAt: "2026-01-15" },
  { id: "st010", memberId: "m004", memberName: "山田 大樹", toolName: "Claude", plan: "Pro", monthlyCost: 3200, companyLabel: "Boost", updatedAt: "2026-02-01" },
  { id: "st011", memberId: "m004", memberName: "山田 大樹", toolName: "GitHub", plan: "Team", monthlyCost: 1500, companyLabel: "Boost", updatedAt: "2026-01-15" },
  { id: "st012", memberId: "m004", memberName: "山田 大樹", toolName: "AWS", plan: "従量課金", monthlyCost: 8500, companyLabel: "Boost", note: "開発環境", updatedAt: "2026-02-05" },
  { id: "st013", memberId: "m006", memberName: "小林 蓮", toolName: "GitHub", plan: "Free", monthlyCost: 0, companyLabel: "Boost", updatedAt: "2024-04-01" },
  { id: "st014", memberId: "m007", memberName: "伊藤 さくら", toolName: "GitHub", plan: "Free", monthlyCost: 0, companyLabel: "Boost", updatedAt: "2024-06-01" },
  // SALT2 メンバー
  { id: "st015", memberId: "m005", memberName: "中村 由美", toolName: "Claude", plan: "Pro", monthlyCost: 3200, companyLabel: "SALT2", updatedAt: "2026-02-01" },
  { id: "st016", memberId: "m005", memberName: "中村 由美", toolName: "freee", plan: "法人プレミアム", monthlyCost: 5800, companyLabel: "SALT2", note: "会計管理", updatedAt: "2025-10-01" },
  { id: "st017", memberId: "m005", memberName: "中村 由美", toolName: "Notion", plan: "Business", monthlyCost: 2400, companyLabel: "SALT2", updatedAt: "2026-01-15" },
  { id: "st018", memberId: "m008", memberName: "渡辺 翔", toolName: "Claude", plan: "Pro", monthlyCost: 3200, companyLabel: "SALT2", updatedAt: "2026-02-01" },
  // SALT2 会社名義ツール（擬似メンバー mSALT2 がオーナー）
  { id: "st021", memberId: "mSALT2", memberName: "SALT2（会社）", toolName: "AWS", plan: "本番環境（従量課金）", monthlyCost: 45000, companyLabel: "SALT2", note: "本番・ステージング環境一括", updatedAt: "2026-02-10" },
  { id: "st022", memberId: "mSALT2", memberName: "SALT2（会社）", toolName: "GitHub", plan: "Team", monthlyCost: 2500, companyLabel: "SALT2", note: "組織アカウント", updatedAt: "2026-01-15" },
  { id: "st023", memberId: "mSALT2", memberName: "SALT2（会社）", toolName: "Slack", plan: "Pro", monthlyCost: 8750, companyLabel: "SALT2", note: "全社ライセンス（7名分）", updatedAt: "2026-01-01" },
  { id: "st024", memberId: "mSALT2", memberName: "SALT2（会社）", toolName: "Vercel", plan: "Pro Team", monthlyCost: 4000, companyLabel: "SALT2", note: "フロントエンドデプロイ", updatedAt: "2026-01-15" },
];

// ---- Contract Records (MEMBER_CONTRACT entity / DocuSign-style) ----

export interface ContractRecord {
  id: string;
  memberId: string;
  memberName: string;
  status: ContractStatus;
  templateName: string;
  startDate?: string;
  endDate?: string;
  fileUrl?: string;
  sentAt?: string;
  completedAt?: string;
  signerEmail: string;
  company: Company;
}

export const CONTRACT_RECORDS: ContractRecord[] = [
  // 完了済
  {
    id: "cr001", memberId: "m001", memberName: "佐藤 健太",
    status: "completed", templateName: "雇用契約書_v2",
    startDate: "2020-04-01",
    fileUrl: "/mock/contracts/cr001.pdf",
    sentAt: "2020-03-20T10:00:00Z", completedAt: "2020-03-25T14:30:00Z",
    signerEmail: "admin@boost.co.jp", company: "Boost",
  },
  {
    id: "cr002", memberId: "m002", memberName: "田中 翔太",
    status: "completed", templateName: "雇用契約書_v2",
    startDate: "2021-07-01",
    fileUrl: "/mock/contracts/cr002.pdf",
    sentAt: "2021-06-15T10:00:00Z", completedAt: "2021-06-20T11:00:00Z",
    signerEmail: "manager@boost.co.jp", company: "Boost",
  },
  {
    id: "cr003", memberId: "m003", memberName: "鈴木 美咲",
    status: "completed", templateName: "雇用契約書_v2",
    startDate: "2022-04-01",
    fileUrl: "/mock/contracts/cr003.pdf",
    sentAt: "2022-03-18T09:00:00Z", completedAt: "2022-03-22T16:00:00Z",
    signerEmail: "employee@boost.co.jp", company: "Boost",
  },
  {
    id: "cr004", memberId: "m004", memberName: "山田 大樹",
    status: "completed", templateName: "雇用契約書_v2",
    startDate: "2022-10-01",
    fileUrl: "/mock/contracts/cr004.pdf",
    sentAt: "2022-09-12T10:00:00Z", completedAt: "2022-09-15T10:00:00Z",
    signerEmail: "yamada@boost.co.jp", company: "Boost",
  },
  {
    id: "cr005", memberId: "m005", memberName: "中村 由美",
    status: "completed", templateName: "雇用契約書_v1",
    startDate: "2020-07-01",
    fileUrl: "/mock/contracts/cr005.pdf",
    sentAt: "2020-06-20T10:00:00Z", completedAt: "2020-06-24T15:00:00Z",
    signerEmail: "admin@salt2.co.jp", company: "SALT2",
  },
  // インターン（期限付き）
  {
    id: "cr006", memberId: "m006", memberName: "小林 蓮",
    status: "completed", templateName: "インターン契約書_v1",
    startDate: "2024-04-01", endDate: "2025-03-31",
    fileUrl: "/mock/contracts/cr006.pdf",
    sentAt: "2024-03-25T10:00:00Z", completedAt: "2024-03-28T12:00:00Z",
    signerEmail: "intern@boost.co.jp", company: "Boost",
  },
  {
    id: "cr007", memberId: "m006", memberName: "小林 蓮",
    status: "waiting_sign", templateName: "インターン契約更新書_v1",
    startDate: "2025-04-01", endDate: "2026-03-31",
    sentAt: "2026-02-10T10:00:00Z",
    signerEmail: "intern@boost.co.jp", company: "Boost",
  },
  {
    id: "cr008", memberId: "m007", memberName: "伊藤 さくら",
    status: "completed", templateName: "インターン契約書_v1",
    startDate: "2024-06-01", endDate: "2025-05-31",
    fileUrl: "/mock/contracts/cr008.pdf",
    sentAt: "2024-05-20T10:00:00Z", completedAt: "2024-05-24T14:00:00Z",
    signerEmail: "ito@boost.co.jp", company: "Boost",
  },
  // 業務委託
  {
    id: "cr009", memberId: "m008", memberName: "渡辺 翔",
    status: "completed", templateName: "業務委託契約書_v3",
    startDate: "2023-01-01",
    fileUrl: "/mock/contracts/cr009.pdf",
    sentAt: "2022-12-15T10:00:00Z", completedAt: "2022-12-20T11:00:00Z",
    signerEmail: "watanabe@salt2.co.jp", company: "SALT2",
  },
  // 新規（送付中・ドラフト）
  {
    id: "cr010", memberId: "m004", memberName: "山田 大樹",
    status: "sent", templateName: "雇用契約書（更新）_v3",
    startDate: "2026-10-01",
    sentAt: "2026-02-15T10:00:00Z",
    signerEmail: "yamada@boost.co.jp", company: "Boost",
  },
  {
    id: "cr011", memberId: "m008", memberName: "渡辺 翔",
    status: "draft", templateName: "業務委託契約書（更新）_v4",
    startDate: "2026-04-01",
    signerEmail: "watanabe@salt2.co.jp", company: "SALT2",
  },
];

export function getContractStatusLabel(status: ContractStatus): string {
  const labels: Record<ContractStatus, string> = {
    draft: "下書き",
    sent: "送付済",
    waiting_sign: "署名待ち",
    completed: "締結完了",
    voided: "無効",
  };
  return labels[status];
}

// ---- Helper Functions ----

// ---- Monthly Self Report (M3-06 月次プロジェクト工数自己申告) ----

export type SelfReportStatus = "not_submitted" | "submitted" | "diff_warning";

export interface SelfReportAllocation {
  projectId: string;
  projectName: string;
  reportedHours: number;
}

export interface SelfReportRecord {
  memberId: string;
  memberName: string;
  targetMonth: string;
  status: SelfReportStatus;
  actualHours: number;      // 打刻実績
  totalReportedHours: number; // 申告合計
  allocations: SelfReportAllocation[];
  submittedAt?: string;
}

export const SELF_REPORTS: SelfReportRecord[] = [
  // 2026-01（前月・申告完了）
  {
    memberId: "m003", memberName: "鈴木 美咲", targetMonth: "2026-01",
    status: "submitted", actualHours: 160, totalReportedHours: 160,
    allocations: [{ projectId: "p001", projectName: "新規SaaS開発", reportedHours: 160 }],
    submittedAt: "2026-01-31T17:00:00Z",
  },
  {
    memberId: "m004", memberName: "山田 大樹", targetMonth: "2026-01",
    status: "diff_warning", actualHours: 152, totalReportedHours: 160,
    allocations: [{ projectId: "p002", projectName: "基幹システム移行", reportedHours: 160 }],
    submittedAt: "2026-01-31T16:30:00Z",
  },
  {
    memberId: "m006", memberName: "小林 蓮", targetMonth: "2026-01",
    status: "submitted", actualHours: 64, totalReportedHours: 64,
    allocations: [{ projectId: "p001", projectName: "新規SaaS開発", reportedHours: 64 }],
    submittedAt: "2026-01-31T18:00:00Z",
  },
  {
    memberId: "m007", memberName: "伊藤 さくら", targetMonth: "2026-01",
    status: "submitted", actualHours: 40, totalReportedHours: 40,
    allocations: [{ projectId: "p002", projectName: "基幹システム移行", reportedHours: 40 }],
    submittedAt: "2026-01-31T17:45:00Z",
  },
  {
    memberId: "m008", memberName: "渡辺 翔", targetMonth: "2026-01",
    status: "submitted", actualHours: 160, totalReportedHours: 160,
    allocations: [
      { projectId: "p003", projectName: "EC分析ダッシュボード", reportedHours: 128 },
      { projectId: "p004", projectName: "社内業務効率化ツール", reportedHours: 32 },
    ],
    submittedAt: "2026-01-31T15:00:00Z",
  },
  // 2026-02（当月・申告中）
  {
    memberId: "m003", memberName: "鈴木 美咲", targetMonth: "2026-02",
    status: "not_submitted", actualHours: 74, totalReportedHours: 0,
    allocations: [],
  },
  {
    memberId: "m008", memberName: "渡辺 翔", targetMonth: "2026-02",
    status: "not_submitted", actualHours: 50, totalReportedHours: 0,
    allocations: [],
  },
];

export function getMemberById(id: string): Member | undefined {
  return MEMBERS.find((m) => m.id === id);
}

export function getProjectById(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getMemberProjects(memberId: string): Project[] {
  return PROJECTS.filter((p) =>
    p.assignments.some((a) => a.memberId === memberId)
  );
}

export function getWeeklySchedule(memberId: string): WeeklySchedule | undefined {
  return WEEKLY_SCHEDULES.find((w) => w.memberId === memberId);
}

export function getTodayAttendance(memberId: string): AttendanceRecord | undefined {
  return ATTENDANCE_RECORDS.find((a) => a.memberId === memberId && a.date === "2026-02-20");
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

export function getStatusLabel(status: AttendanceStatus): string {
  const labels: Record<AttendanceStatus, string> = {
    not_started: "未出勤",
    working: "出勤中",
    break: "休憩中",
    done: "退勤済",
    absent: "欠勤",
  };
  return labels[status];
}

export function getInvoiceStatusLabel(status: InvoiceStatus): string {
  const labels: Record<InvoiceStatus, string> = {
    draft: "下書き",
    sent: "送付済",
    paid: "入金済",
    overdue: "期限超過",
  };
  return labels[status];
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  const labels: Record<ProjectStatus, string> = {
    active: "進行中",
    completed: "完了",
    on_hold: "一時停止",
  };
  return labels[status];
}

// ---- Monthly Attendance Records (勤怠履歴 M4-04用) ----

export interface DailyAttendance {
  id: string;
  memberId: string;
  date: string;
  clockIn?: string;
  clockOut?: string;
  breakMinutes: number;
  actualHours?: number;
  status: AttendanceStatus;
  note?: string;
  isModified?: boolean;
}

// 2026-02 の日別勤怠（メンバー m001〜m004 分、平日のみ）
export const DAILY_ATTENDANCE: DailyAttendance[] = [
  // 佐藤（m001）
  { id: "da001", memberId: "m001", date: "2026-02-02", clockIn: "09:05", clockOut: "18:30", breakMinutes: 60, actualHours: 8.4, status: "done" },
  { id: "da002", memberId: "m001", date: "2026-02-03", clockIn: "09:10", clockOut: "19:00", breakMinutes: 60, actualHours: 8.8, status: "done" },
  { id: "da003", memberId: "m001", date: "2026-02-04", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60, actualHours: 8.0, status: "done" },
  { id: "da004", memberId: "m001", date: "2026-02-05", clockIn: "09:15", clockOut: "17:45", breakMinutes: 60, actualHours: 7.5, status: "done" },
  { id: "da005", memberId: "m001", date: "2026-02-06", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60, actualHours: 8.0, status: "done" },
  { id: "da006", memberId: "m001", date: "2026-02-09", clockIn: "09:05", clockOut: "18:30", breakMinutes: 60, actualHours: 8.4, status: "done" },
  { id: "da007", memberId: "m001", date: "2026-02-10", clockIn: "09:00", clockOut: "19:30", breakMinutes: 60, actualHours: 9.5, status: "done" },
  { id: "da008", memberId: "m001", date: "2026-02-12", clockIn: "09:10", clockOut: "18:10", breakMinutes: 60, actualHours: 8.0, status: "done" },
  { id: "da009", memberId: "m001", date: "2026-02-13", clockIn: "09:00", clockOut: "18:00", breakMinutes: 60, actualHours: 8.0, status: "done" },
  { id: "da010", memberId: "m001", date: "2026-02-16", clockIn: "09:10", clockOut: "18:30", breakMinutes: 60, actualHours: 8.3, status: "done" },
  { id: "da011", memberId: "m001", date: "2026-02-17", clockIn: "09:05", clockOut: "19:00", breakMinutes: 60, actualHours: 8.9, status: "done" },
  { id: "da012", memberId: "m001", date: "2026-02-18", clockIn: "09:00", clockOut: "18:15", breakMinutes: 60, actualHours: 8.2, status: "done" },
  { id: "da013", memberId: "m001", date: "2026-02-19", clockIn: "09:15", clockOut: "18:00", breakMinutes: 60, actualHours: 7.7, status: "done" },
  { id: "da014", memberId: "m001", date: "2026-02-20", clockIn: "09:10", breakMinutes: 60, status: "working" },
  // 鈴木（m003 インターン含め確認しやすいよう）
  { id: "da020", memberId: "m003", date: "2026-02-02", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da021", memberId: "m003", date: "2026-02-03", clockIn: "09:45", clockOut: "18:30", breakMinutes: 45, actualHours: 8.0, status: "done" },
  { id: "da022", memberId: "m003", date: "2026-02-04", clockIn: "09:30", clockOut: "18:00", breakMinutes: 45, actualHours: 7.8, status: "done" },
  { id: "da023", memberId: "m003", date: "2026-02-05", clockIn: "09:30", clockOut: "19:30", breakMinutes: 45, actualHours: 9.2, status: "done" },
  { id: "da024", memberId: "m003", date: "2026-02-06", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da025", memberId: "m003", date: "2026-02-09", status: "absent", breakMinutes: 0, note: "有給休暇" },
  { id: "da026", memberId: "m003", date: "2026-02-10", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da027", memberId: "m003", date: "2026-02-12", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da028", memberId: "m003", date: "2026-02-13", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da029", memberId: "m003", date: "2026-02-16", clockIn: "09:30", clockOut: "18:30", breakMinutes: 45, actualHours: 8.2, status: "done" },
  { id: "da030", memberId: "m003", date: "2026-02-17", clockIn: "09:45", clockOut: "18:30", breakMinutes: 45, actualHours: 8.0, status: "done" },
  { id: "da031", memberId: "m003", date: "2026-02-18", clockIn: "09:30", clockOut: "18:00", breakMinutes: 45, actualHours: 7.8, status: "done" },
  { id: "da032", memberId: "m003", date: "2026-02-19", clockIn: "09:30", clockOut: "19:30", breakMinutes: 45, actualHours: 9.2, status: "done" },
  { id: "da033", memberId: "m003", date: "2026-02-20", clockIn: "09:30", breakMinutes: 45, status: "working" },
  // 小林インターン（m006）
  { id: "da040", memberId: "m006", date: "2026-02-03", clockIn: "13:00", clockOut: "18:00", breakMinutes: 0, actualHours: 5.0, status: "done" },
  { id: "da041", memberId: "m006", date: "2026-02-05", clockIn: "13:00", clockOut: "18:00", breakMinutes: 0, actualHours: 5.0, status: "done" },
  { id: "da042", memberId: "m006", date: "2026-02-10", clockIn: "13:00", clockOut: "18:00", breakMinutes: 0, actualHours: 5.0, status: "done" },
  { id: "da043", memberId: "m006", date: "2026-02-12", clockIn: "13:00", clockOut: "17:30", breakMinutes: 0, actualHours: 4.5, status: "done" },
  { id: "da044", memberId: "m006", date: "2026-02-17", clockIn: "13:00", clockOut: "18:00", breakMinutes: 0, actualHours: 5.0, status: "done" },
  { id: "da045", memberId: "m006", date: "2026-02-19", clockIn: "13:00", clockOut: "18:00", breakMinutes: 0, actualHours: 5.0, status: "done" },
  { id: "da046", memberId: "m006", date: "2026-02-20", clockIn: "13:00", breakMinutes: 0, status: "working" },
];

// ---- Cashflow Data (M6-03) ----

export interface CashflowRecord {
  month: string;
  openingBalance: number;
  cashInClient: number;
  cashInOther: number;
  cashOutSalary: number;
  cashOutFreelance: number;
  cashOutFixed: number;
  cashOutOther: number;
  company: Company;
}

export const CASHFLOW_RECORDS: CashflowRecord[] = [
  // Boost
  { month: "2025-09", company: "Boost", openingBalance: 8500000, cashInClient: 1800000, cashInOther: 0, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 80000 },
  { month: "2025-10", company: "Boost", openingBalance: 8010000, cashInClient: 1900000, cashInOther: 0, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 60000 },
  { month: "2025-11", company: "Boost", openingBalance: 7640000, cashInClient: 2000000, cashInOther: 100000, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 90000 },
  { month: "2025-12", company: "Boost", openingBalance: 7440000, cashInClient: 1900000, cashInOther: 0, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 120000 },
  { month: "2026-01", company: "Boost", openingBalance: 7010000, cashInClient: 2000000, cashInOther: 0, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 70000 },
  { month: "2026-02", company: "Boost", openingBalance: 6730000, cashInClient: 1760000, cashInOther: 0, cashOutSalary: 1860000, cashOutFreelance: 0, cashOutFixed: 350000, cashOutOther: 50000 },
  // SALT2
  { month: "2025-09", company: "SALT2", openingBalance: 3200000, cashInClient: 600000, cashInOther: 0, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 30000 },
  { month: "2025-10", company: "SALT2", openingBalance: 2230000, cashInClient: 650000, cashInOther: 0, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 20000 },
  { month: "2025-11", company: "SALT2", openingBalance: 1320000, cashInClient: 700000, cashInOther: 200000, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 25000 },
  { month: "2025-12", company: "SALT2", openingBalance: 655000, cashInClient: 700000, cashInOther: 0, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 40000 },
  { month: "2026-01", company: "SALT2", openingBalance: -225000, cashInClient: 1400000, cashInOther: 0, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 30000 },
  { month: "2026-02", company: "SALT2", openingBalance: -395000, cashInClient: 770000, cashInOther: 0, cashOutSalary: 620000, cashOutFreelance: 800000, cashOutFixed: 120000, cashOutOther: 20000 },
];

// ---- Work Schedule (勤務予定 M4-02用) ----

export interface WorkScheduleEntry {
  memberId: string;
  date: string;
  dayLabel: string;
  isHoliday: boolean;
  plannedStart?: string;
  plannedEnd?: string;
  workType?: "出社" | "オンライン" | "休み";
}

// 翌週（2026-02-23 〜 2026-03-01）の予定フォーム初期値
export const NEXT_WEEK_TEMPLATE: Omit<WorkScheduleEntry, "memberId">[] = [
  { date: "2026-02-23", dayLabel: "月", isHoliday: false, plannedStart: "09:30", plannedEnd: "18:30", workType: "オンライン" },
  { date: "2026-02-24", dayLabel: "火", isHoliday: false, plannedStart: "09:30", plannedEnd: "18:30", workType: "出社" },
  { date: "2026-02-25", dayLabel: "水", isHoliday: false, plannedStart: "09:30", plannedEnd: "18:30", workType: "出社" },
  { date: "2026-02-26", dayLabel: "木", isHoliday: false, plannedStart: "09:30", plannedEnd: "18:30", workType: "オンライン" },
  { date: "2026-02-27", dayLabel: "金", isHoliday: false, plannedStart: "09:30", plannedEnd: "18:30", workType: "出社" },
  { date: "2026-02-28", dayLabel: "土", isHoliday: true },
  { date: "2026-03-01", dayLabel: "日", isHoliday: true },
];

// ---- Project Positions (ポジション定義) ----

export interface ProjectPosition {
  id: string;
  projectId: string;
  name: string;
  requiredCount: number;
  filledCount: number;
  requiredSkills: string[];
  description?: string;
}

export const PROJECT_POSITIONS: ProjectPosition[] = [
  { id: "pos001", projectId: "p001", name: "PM", requiredCount: 1, filledCount: 1, requiredSkills: ["s005"], description: "プロジェクト全体管理" },
  { id: "pos002", projectId: "p001", name: "フロントエンドエンジニア", requiredCount: 2, filledCount: 2, requiredSkills: ["s001", "s002"], description: "React/Next.js実装" },
  { id: "pos003", projectId: "p001", name: "デザイナー", requiredCount: 1, filledCount: 0, requiredSkills: ["s006"], description: "UI/UX設計" },
  { id: "pos004", projectId: "p002", name: "PM", requiredCount: 1, filledCount: 1, requiredSkills: ["s005"] },
  { id: "pos005", projectId: "p002", name: "バックエンドエンジニア", requiredCount: 1, filledCount: 1, requiredSkills: ["s003", "s004"] },
  { id: "pos006", projectId: "p002", name: "インフラエンジニア", requiredCount: 1, filledCount: 1, requiredSkills: ["s007"] },
  { id: "pos007", projectId: "p003", name: "PM", requiredCount: 1, filledCount: 1, requiredSkills: ["s005"] },
  { id: "pos008", projectId: "p003", name: "フルスタックエンジニア", requiredCount: 1, filledCount: 1, requiredSkills: ["s001", "s003"] },
];

// ---- Settings ----

export interface SystemSettings {
  slackWebhookUrl: string;
  attendanceChannel: string;
  closingNotifyDay: number;
  companyNamePrimary: string;
  companyNameSecondary: string;
  fiscalYearStart: number;
  overtimeThreshold: number;
  markupRate: number; // Boost 派遣案件の掛け率（例: 1.20 = 人件費の20%上乗せ）
}

export const SYSTEM_SETTINGS: SystemSettings = {
  slackWebhookUrl: "", // 実際の値は .env の SLACK_WEBHOOK_URL で設定
  attendanceChannel: "#attendance",
  closingNotifyDay: 25,
  companyNamePrimary: "ブーストコンサルティング株式会社",
  companyNameSecondary: "SALT2株式会社",
  fiscalYearStart: 4,
  overtimeThreshold: 160,
  markupRate: 1.20,
};
