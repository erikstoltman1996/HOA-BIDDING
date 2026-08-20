/**
 * Seeds a demo org, admin, two board members, a project, line items, two
 * sample bids (ported from the bid-ledger.html prototype), and an in-flight
 * board check-in — so `npm run dev` shows a working app end to end without
 * any manual data entry.
 *
 * Run with: npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */
import { createClient } from "@supabase/supabase-js";
import { currentPeriod, shiftPeriod } from "../lib/dues";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Run this with: npm run seed (it loads .env.local automatically via --env-file).",
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEMO_PASSWORD = "BidLedgerDemo123!";

const DEMO_ADMIN = { email: "admin@demo.bidledger.app", name: "Jordan Kim" };
const DEMO_BOARD_MEMBERS = [
  { email: "pat@demo.bidledger.app", name: "Pat Rivera" },
  { email: "sam@demo.bidledger.app", name: "Sam Chen" },
];

async function getOrCreateAuthUser(email: string, name: string) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  });
  if (!error) return created.user;

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;
  const existing = list.users.find((u) => u.email === email);
  if (!existing) throw error;
  return existing;
}

async function main() {
  console.log("Seeding demo data…");

  const adminUser = await getOrCreateAuthUser(DEMO_ADMIN.email, DEMO_ADMIN.name);

  const { data: existingProfile } = await admin
    .from("users")
    .select("org_id")
    .eq("id", adminUser.id)
    .maybeSingle();

  let orgId = existingProfile?.org_id as string | undefined;

  if (!orgId) {
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: "Elmhurst HOA" })
      .select()
      .single();
    if (orgError) throw orgError;
    orgId = org.id;

    await admin.from("users").upsert({
      id: adminUser.id,
      org_id: orgId,
      email: DEMO_ADMIN.email,
      name: DEMO_ADMIN.name,
      role: "admin",
    });
  }

  const boardMemberIds: string[] = [];
  for (const bm of DEMO_BOARD_MEMBERS) {
    const user = await getOrCreateAuthUser(bm.email, bm.name);
    await admin.from("users").upsert({
      id: user.id,
      org_id: orgId,
      email: bm.email,
      name: bm.name,
      role: "board_member",
    });
    boardMemberIds.push(user.id);
  }

  let { data: project } = await admin
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .eq("title", "Roof Replacement — 33 W Elmhurst Ave")
    .maybeSingle();
  if (!project) {
    const { data: created, error } = await admin
      .from("projects")
      .insert({
        org_id: orgId,
        title: "Roof Replacement — 33 W Elmhurst Ave",
        status: "bidding",
      })
      .select()
      .single();
    if (error) throw error;
    project = created;
  }

  // A second, already-finished project — matched by title (not maybeSingle
  // on org_id alone, which would now throw once an org has more than one
  // project) — so /projects has something real to list, not just one card.
  const { data: pastProject } = await admin
    .from("projects")
    .select("*")
    .eq("org_id", orgId)
    .eq("title", "Clubhouse HVAC Replacement (2025)")
    .maybeSingle();
  if (!pastProject) {
    const { error } = await admin.from("projects").insert({
      org_id: orgId,
      title: "Clubhouse HVAC Replacement (2025)",
      status: "complete",
    });
    if (error) throw error;
  }

  const { data: existingItems } = await admin
    .from("line_items")
    .select("*")
    .eq("project_id", project.id);

  let lineItems = existingItems ?? [];
  if (lineItems.length === 0) {
    const { data: inserted, error } = await admin
      .from("line_items")
      .insert(
        ["Labor", "Materials", "Permits & fees", "Disposal / cleanup", "Contingency"].map(
          (label, i) => ({ project_id: project!.id, label, sort_order: i }),
        ),
      )
      .select();
    if (error) throw error;
    lineItems = inserted;
  }
  const itemIdByLabel = Object.fromEntries(lineItems.map((it) => [it.label, it.id]));

  const { data: existingBids } = await admin.from("bids").select("*").eq("project_id", project.id);
  if (!existingBids || existingBids.length === 0) {
    const bidSeed = [
      {
        vendor_name: "Northgate Roofing Co.",
        warranty_years: 10,
        timeline_weeks: 3,
        notes: "Owner-operator, 14 yrs in business. Two references checked out.",
        amounts: { Labor: 8400, Materials: 11200, "Permits & fees": 650, "Disposal / cleanup": 900, Contingency: 1200 },
      },
      {
        vendor_name: "Summit Exteriors",
        warranty_years: 15,
        timeline_weeks: 2,
        notes: "Larger crew, faster turnaround. Slightly higher labor rate.",
        amounts: { Labor: 9100, Materials: 10400, "Permits & fees": 500, "Disposal / cleanup": 750, Contingency: 1500 },
      },
    ];

    for (const seed of bidSeed) {
      const { data: bid, error } = await admin
        .from("bids")
        .insert({
          project_id: project.id,
          vendor_name: seed.vendor_name,
          warranty_years: seed.warranty_years,
          timeline_weeks: seed.timeline_weeks,
          notes: seed.notes,
        })
        .select()
        .single();
      if (error) throw error;

      await admin.from("bid_line_item_amounts").insert(
        Object.entries(seed.amounts).map(([label, amount]) => ({
          bid_id: bid.id,
          line_item_id: itemIdByLabel[label],
          amount,
        })),
      );
    }
  }

  const { data: existingCheckins } = await admin
    .from("board_checkins")
    .select("*")
    .eq("project_id", project.id);

  if (!existingCheckins || existingCheckins.length === 0) {
    const { data: bids } = await admin.from("bids").select("id, vendor_name").eq("project_id", project.id);
    const northgate = bids?.find((b) => b.vendor_name === "Northgate Roofing Co.");

    const { data: checkin, error: checkinError } = await admin
      .from("board_checkins")
      .insert({ project_id: project.id, respond_by: null, created_by: adminUser.id })
      .select()
      .single();
    if (checkinError) throw checkinError;

    await admin.from("checkin_responses").insert([
      {
        checkin_id: checkin.id,
        board_member_id: boardMemberIds[0],
        name: DEMO_BOARD_MEMBERS[0].name,
        email: DEMO_BOARD_MEMBERS[0].email,
        pick_bid_id: northgate?.id ?? null,
        note: "References checked out for me too — go with Northgate.",
        responded_at: new Date().toISOString(),
      },
      {
        checkin_id: checkin.id,
        board_member_id: boardMemberIds[1],
        name: DEMO_BOARD_MEMBERS[1].name,
        email: DEMO_BOARD_MEMBERS[1].email,
      },
    ]);
  }

  const { data: existingContractors } = await admin
    .from("contractors")
    .select("*")
    .eq("project_id", project.id);

  let contractor = existingContractors?.[0];
  if (!contractor) {
    const { data: created, error } = await admin
      .from("contractors")
      .insert({
        project_id: project.id,
        name: "Northgate Roofing Co.",
        contact_email: "crew@northgateroofing.demo",
        contact_phone: "555-0142",
      })
      .select()
      .single();
    if (error) throw error;
    contractor = created;

    // Two sample weekly updates so the timeline isn't empty. No real photo
    // files are attached — the contractor portal is where real photos get
    // uploaded.
    await admin.from("weekly_updates").insert([
      {
        project_id: project.id,
        contractor_id: contractor.id,
        percent_complete: 25,
        timeline_status: "on_track",
        issues_text: "Tear-off complete on the south face, no surprises under the old shingles.",
        next_milestone_date: null,
        created_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        project_id: project.id,
        contractor_id: contractor.id,
        percent_complete: 55,
        timeline_status: "ahead",
        issues_text: "Weather cooperated, decking is done a few days early.",
        next_milestone_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]);
  }

  const { data: existingResidents } = await admin.from("residents").select("*").eq("org_id", orgId);
  let residents = existingResidents ?? [];
  if (residents.length === 0) {
    const { data: inserted, error } = await admin
      .from("residents")
      .insert([
        { org_id: orgId, unit_label: "Building A, Unit 1" },
        { org_id: orgId, unit_label: "Building A, Unit 2" },
        { org_id: orgId, unit_label: "Building B, Unit 1" },
      ])
      .select();
    if (error) throw error;
    residents = inserted;
  }

  const { data: existingPolls } = await admin.from("board_polls").select("*").eq("org_id", orgId);
  if (!existingPolls || existingPolls.length === 0) {
    const { data: poll, error: pollError } = await admin
      .from("board_polls")
      .insert({
        org_id: orgId,
        question: "Should we use this year's capital funds to upgrade the pool or fix the Building B decks?",
        description: "Both projects are in the reserve study. We can only fund one this year.",
        created_by: adminUser.id,
      })
      .select()
      .single();
    if (pollError) throw pollError;

    const { data: pollOptions, error: optionsError } = await admin
      .from("poll_options")
      .insert([
        { poll_id: poll.id, label: "Upgrade the pool", sort_order: 0 },
        { poll_id: poll.id, label: "Fix Building B decks", sort_order: 1 },
      ])
      .select();
    if (optionsError) throw optionsError;

    await admin.from("poll_responses").insert({
      poll_id: poll.id,
      resident_id: residents[0].id,
      option_id: pollOptions[1].id,
      note: "The decks feel unsafe already, that seems more urgent.",
    });
  }

  const { data: existingSettings } = await admin
    .from("reserve_settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();
  if (!existingSettings) {
    await admin.from("reserve_settings").insert({
      org_id: orgId,
      current_balance: 145_000,
      annual_contribution: 20_000,
    });
  }

  const { data: existingAssets } = await admin.from("reserve_assets").select("*").eq("org_id", orgId);
  if (!existingAssets || existingAssets.length === 0) {
    await admin.from("reserve_assets").insert([
      { org_id: orgId, name: "Pool & pump", expected_lifespan_years: 8, replacement_cost: 18_000, current_age_years: 5 },
      { org_id: orgId, name: "Building A Roof", expected_lifespan_years: 25, replacement_cost: 90_000, current_age_years: 12 },
      { org_id: orgId, name: "Building B Decks", expected_lifespan_years: 15, replacement_cost: 40_000, current_age_years: 13 },
      { org_id: orgId, name: "Clubhouse HVAC", expected_lifespan_years: 12, replacement_cost: 25_000, current_age_years: 4 },
    ]);
  }

  const { data: existingUnits } = await admin.from("units").select("*").eq("org_id", orgId);
  let units = existingUnits ?? [];
  if (units.length === 0) {
    const { data: inserted, error } = await admin
      .from("units")
      .insert([
        { org_id: orgId, label: "Building A, Unit 1", owner_name: "Dana Ruiz", owner_email: "dana@demo.bidledger.app", monthly_dues_amount: 350 },
        { org_id: orgId, label: "Building A, Unit 2", owner_name: "Marcus Lee", owner_email: "marcus@demo.bidledger.app", monthly_dues_amount: 350 },
        { org_id: orgId, label: "Building B, Unit 1", owner_name: "Priya Nair", owner_email: "priya@demo.bidledger.app", monthly_dues_amount: 400 },
        { org_id: orgId, label: "Building B, Unit 2", owner_name: "HOA-owned (community room)", owner_email: null, monthly_dues_amount: 400 },
      ])
      .select();
    if (error) throw error;
    units = inserted;
  }

  const { data: existingCharges } = await admin.from("dues_charges").select("id").limit(1);
  if (!existingCharges || existingCharges.length === 0) {
    const thisPeriod = currentPeriod();
    const lastPeriod = shiftPeriod(thisPeriod, -1);

    // This period: a realistic in-progress mix — two paid, one still
    // outstanding, one waived (the HOA-owned unit) so the dashboard's
    // collection-rate exclusion rule has something real to show.
    await admin.from("dues_charges").insert([
      { unit_id: units[0].id, period: thisPeriod, amount_due: units[0].monthly_dues_amount, status: "paid", paid_date: thisPeriod },
      { unit_id: units[1].id, period: thisPeriod, amount_due: units[1].monthly_dues_amount, status: "unpaid" },
      { unit_id: units[2].id, period: thisPeriod, amount_due: units[2].monthly_dues_amount, status: "paid", paid_date: thisPeriod },
      { unit_id: units[3].id, period: thisPeriod, amount_due: units[3].monthly_dues_amount, status: "waived" },
    ]);

    // Last period: fully collected, so the period navigator on /dues has
    // somewhere to go and shows a different (better) rate than the current one.
    await admin.from("dues_charges").insert(
      units.map((u) => ({
        unit_id: u.id,
        period: lastPeriod,
        amount_due: u.monthly_dues_amount,
        status: "paid" as const,
        paid_date: lastPeriod,
      })),
    );
  }

  const { data: existingCategories } = await admin.from("expense_categories").select("*").eq("org_id", orgId);
  let expenseCategories = existingCategories ?? [];
  if (expenseCategories.length === 0) {
    const { data: inserted, error } = await admin
      .from("expense_categories")
      .insert([
        { org_id: orgId, name: "Landscaping", sort_order: 0 },
        { org_id: orgId, name: "Insurance", sort_order: 1 },
        { org_id: orgId, name: "Utilities", sort_order: 2 },
        { org_id: orgId, name: "Snow Removal", sort_order: 3 },
      ])
      .select();
    if (error) throw error;
    expenseCategories = inserted;
  }

  const { data: existingExpenseEntries } = await admin.from("expense_entries").select("id").limit(1);
  if (!existingExpenseEntries || existingExpenseEntries.length === 0) {
    const thisPeriod = currentPeriod();
    const lastPeriod = shiftPeriod(thisPeriod, -1);
    // This period: a realistic partial mix (some categories not entered
    // yet) so the "N of M categories entered" stat has something to show.
    await admin.from("expense_entries").insert([
      { category_id: expenseCategories[0].id, period: thisPeriod, amount: 620 },
      { category_id: expenseCategories[1].id, period: thisPeriod, amount: 410 },
      // Utilities and Snow Removal intentionally left unentered this period.
    ]);
    // Last period: fully entered.
    await admin.from("expense_entries").insert(
      expenseCategories.map((c, i) => ({
        category_id: c.id,
        period: lastPeriod,
        amount: [620, 410, 180, 250][i] ?? 100,
      })),
    );
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

  console.log("\nSeed complete.\n");
  console.log("Log in with:");
  console.log(`  Admin:        ${DEMO_ADMIN.email} / ${DEMO_PASSWORD}`);
  DEMO_BOARD_MEMBERS.forEach((bm) => console.log(`  Board member: ${bm.email} / ${DEMO_PASSWORD}`));
  console.log("\nNo-login demo links:");
  console.log(`  Contractor update form: ${siteUrl}/contractor/${contractor.access_token}`);
  console.log(`  Resident voting page:   ${siteUrl}/vote/${residents[0].access_token}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
