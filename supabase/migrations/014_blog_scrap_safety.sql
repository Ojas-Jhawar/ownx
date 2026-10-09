-- Migration 014: blog tags/covers + 8 draft posts, DB-backed scrap rates, device-transfer safety.
-- Run after 013. Safe to re-run.

alter table public.blog_posts add column if not exists tags text[] not null default '{}';
create index if not exists blog_posts_tags_idx on public.blog_posts using gin (tags);

insert into storage.buckets (id, name, public) values ('blog-covers', 'blog-covers', true) on conflict (id) do nothing;
drop policy if exists "Admins upload blog covers" on storage.objects;
create policy "Admins upload blog covers" on storage.objects for insert with check (bucket_id = 'blog-covers' and public.is_admin());
drop policy if exists "Admins replace blog covers" on storage.objects;
create policy "Admins replace blog covers" on storage.objects for update using (bucket_id = 'blog-covers' and public.is_admin());
drop policy if exists "Admins delete blog covers" on storage.objects;
create policy "Admins delete blog covers" on storage.objects for delete using (bucket_id = 'blog-covers' and public.is_admin());
drop policy if exists "Anyone can view blog covers" on storage.objects;
create policy "Anyone can view blog covers" on storage.objects for select using (bucket_id = 'blog-covers');

create table if not exists public.scrap_rates (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  kind text not null check (kind in ('weight', 'precious')),
  pct_of_weight numeric,
  rate_per_kg numeric,
  grams numeric,
  rate_per_gram numeric,
  updated_at timestamptz not null default now(),
  unique (category, name)
);
drop trigger if exists scrap_rates_set_updated_at on public.scrap_rates;
create trigger scrap_rates_set_updated_at before update on public.scrap_rates
  for each row execute procedure public.set_updated_at();
alter table public.scrap_rates enable row level security;
drop policy if exists "Anyone can read scrap rates" on public.scrap_rates;
create policy "Anyone can read scrap rates" on public.scrap_rates for select to anon, authenticated using (true);
drop policy if exists "Admins manage scrap rates" on public.scrap_rates;
create policy "Admins manage scrap rates" on public.scrap_rates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.scrap_rates (category, name, kind, pct_of_weight, rate_per_kg, grams, rate_per_gram) values
('laptop','Aluminium / steel chassis','weight',0.35,150,null,null),
('laptop','Plastic housing','weight',0.2,15,null,null),
('laptop','Copper (wiring / heatsink)','weight',0.05,550,null,null),
('laptop','Battery pack (lithium-ion cells)','weight',0.12,90,null,null),
('laptop','Screen / display panel (glass)','weight',0.13,20,null,null),
('laptop','Other (fans, cabling, misc)','weight',0.15,10,null,null),
('laptop','Gold / palladium plating (connectors, PCB)','precious',null,null,0.025,5500),
('smartphone','Aluminium / steel frame','weight',0.28,140,null,null),
('smartphone','Glass (screen + back)','weight',0.22,8,null,null),
('smartphone','Battery pack (lithium-ion cell)','weight',0.2,90,null,null),
('smartphone','Plastic / other','weight',0.2,15,null,null),
('smartphone','Camera modules & misc metal','weight',0.1,60,null,null),
('smartphone','Gold / palladium plating (connectors, PCB)','precious',null,null,0.034,5500),
('audio','Plastic housing','weight',0.45,15,null,null),
('audio','Copper (coils / wiring)','weight',0.15,550,null,null),
('audio','Battery pack (lithium-ion, if wireless)','weight',0.15,90,null,null),
('audio','Rare-earth magnets (drivers)','weight',0.15,300,null,null),
('audio','Other metal','weight',0.1,60,null,null),
('audio','Gold-plated connectors / PCB','precious',null,null,0.008,5500),
('appliance','Steel body','weight',0.55,35,null,null),
('appliance','Copper (motor / coils)','weight',0.12,550,null,null),
('appliance','Aluminium','weight',0.1,150,null,null),
('appliance','Plastic / other','weight',0.18,15,null,null),
('appliance','Rare-earth / misc metal','weight',0.05,60,null,null),
('appliance','Gold-plated PCB (control board)','precious',null,null,0.01,5500),
('other','Mixed metal','weight',0.4,60,null,null),
('other','Plastic / other','weight',0.55,15,null,null),
('other','Battery (if applicable)','weight',0.05,90,null,null),
('other','Gold-plated PCB (if applicable)','precious',null,null,0.005,5500)
on conflict (category, name) do nothing;

create or replace function public.block_flagged_device_transfer() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.devices d join public.lost_reports r on r.asset_id = d.asset_id
    where d.id = new.device_id and r.status = 'open'
  ) then
    raise exception 'This device is reported lost or stolen and cannot be sold or transferred.';
  end if;
  return new;
end $$;
drop trigger if exists device_transfers_block_flagged on public.device_transfers;
create trigger device_transfers_block_flagged before insert on public.device_transfers
  for each row execute procedure public.block_flagged_device_transfer();

-- Eight draft posts. Review and re-check the factual claims before publishing from /admin/blog.
insert into public.blog_posts (slug, title, excerpt, content, category, tags, status) values
('check-laptop-battery-health', 'How to check your laptop''s battery health (Windows, macOS, Linux)',
 'Three commands and two menus tell you how much capacity your battery has really lost.', $md$
A battery that "feels worse" usually has measurable wear. Compare **design capacity** (what it shipped with) to **full charge capacity** (what it holds now).

## Windows
Open Command Prompt and run `powercfg /batteryreport`. It saves an HTML report. Open it and compare *Design Capacity* with *Full Charge Capacity*.

## macOS
Open **System Settings > Battery > Battery Health**. For raw numbers, run `system_profiler SPPowerDataType` in Terminal and look at *Cycle Count*, *Condition* and *Maximum Capacity*.

## Linux
Run `upower -i $(upower -e | grep BAT)` and compare `energy-full` with `energy-full-design`.

## How to read it
Divide full charge capacity by design capacity. Below about 80% you will notice shorter runtime, and a replacement is worth pricing. Keep the numbers: a dated record helps with warranty claims.

Ownx's AI Diagnose reads these numbers for you and adds them to your passport history.
$md$, 'maintenance', array['battery','laptop','how-to'], 'draft'),
('warranty-rights-india-guide', 'Warranty rights in India: what you can claim and how',
 'A plain-language guide to using a warranty, and where to escalate when a seller refuses.', $md$
*This is general information, not legal advice. Check current rules before relying on it.*

## Keep the proof
A warranty claim starts with the **invoice**, the **serial number** and the **warranty card or terms**. Store all three together.

## Know what is covered
Manufacturer warranties usually cover defects, not accidental or liquid damage. Read the exclusions before you need them.

## If a claim is refused
1. Ask for the refusal in writing, with the reason.
2. Escalate to the brand's grievance or nodal officer.
3. Contact the National Consumer Helpline (1915) for guidance.
4. You can file a complaint with a consumer commission under the Consumer Protection Act, 2019, including online through e-Daakhil.

## Do not wait
Many people discover the warranty ended last month. Set a reminder 30 days before expiry. Ownx emails you at 30 and 7 days.
$md$, 'guide', array['warranty','india','consumer-rights'], 'draft'),
('repair-or-replace-guide', 'Repair or replace? A simple decision guide',
 'Use the 30% rule and three questions to decide in five minutes.', $md$
## The 30% rule
If the repair costs **under about 30%** of a new equivalent and the rest of the device is healthy, repair it. Above **60%**, replacing usually wins.

## Three questions
- **How old is it?** Past 4 to 5 years, parts and software support get harder to find.
- **What else is failing?** One fault is a good repair. Several faults are a warning.
- **Is it still supported?** Check security updates for your model.

## Get a written quote
Ask for the part price and labour separately. Prefer shops that give a warranty on the repair.

## Then decide what happens to the old one
Sell it, hand it down, or recycle it properly. Our [scrap value tool](/tools/scrap-value) and [device advisor](/tools/device-advisor) help you compare.
$md$, 'guide', array['repair','decision','budget'], 'draft'),
('keep-invoices-safe', 'How to keep your invoices safe, and why it matters',
 'Lost receipts cost people warranty claims and insurance payouts. A five-minute habit fixes it.', $md$
## Why invoices matter
An invoice proves **when** you bought, **what** you bought and **from whom**. Warranty, insurance and resale all depend on it.

## A simple system
1. Photograph or scan the invoice the day you buy.
2. Name the file `brand-model-date`.
3. Keep a copy in two places, for example your phone and cloud storage.
4. Note the serial number and warranty length.

## Thermal paper fades
Many receipts are printed on thermal paper that fades within a year or two. Digitise early.

## Let Ownx do it
Upload the invoice and Ownx extracts the product, serial and warranty into a passport you can share read-only.
$md$, 'guide', array['invoice','warranty','organise'], 'draft'),
('e-waste-india-where-to-recycle', 'E-waste in India: where to recycle your electronics',
 'How to dispose of old devices safely and legally.', $md$
*Rules change. Confirm current details with the CPCB or your state pollution control board.*

## Why not the bin
Electronics contain lead, mercury and cadmium, plus recoverable copper, aluminium and trace gold. Dumping wastes both.

## Legitimate options
- **Manufacturer take-back.** Under the E-Waste (Management) Rules, 2022, producers have extended responsibility for their products. Many run collection programmes.
- **Authorised recyclers.** The Central Pollution Control Board publishes a list of authorised recyclers and dismantlers.
- **Retailer exchange offers.** Useful, but ask where the old device goes.

## Before you hand it over
Back up your data, sign out of accounts and factory reset. If the battery is swollen, tell the recycler.

## Know its value
Check the [scrap value](/tools/scrap-value) first so you can judge a fair offer.
$md$, 'sustainability', array['e-waste','recycling','india'], 'draft'),
('what-is-a-digital-product-passport', 'What is a digital product passport?',
 'A digital record that follows a product through its life.', $md$
## The idea
A digital product passport (DPP) is a structured record of a product: what it is, where it came from, how it was repaired and how it can be recycled.

## Why it is coming
The EU's Ecodesign for Sustainable Products Regulation introduces digital product passports for many product groups, rolling out in phases. The aim is more repair, reuse and recycling.

## Ownership passports
Ownx applies the idea at the owner level: invoice, warranty, service history and device health in one record you control, with a read-only link for insurers, shops or family.

## What to look for
A useful passport is **verifiable**: who recorded each entry, and can you trust them? Ownx marks entries as reported, documented or verified.
$md$, 'news', array['passport','sustainability','explainer'], 'draft'),
('signs-phone-battery-needs-replacing', 'Signs your phone battery needs replacing',
 'Five symptoms and one number that tell you it is time.', $md$
## Symptoms
- Charge drops fast, or the phone dies at 20 to 30%.
- The phone shuts down in the cold or under load.
- It runs hot while charging.
- The back or screen bulges. **Stop using it and get it checked at once.**
- Performance throttling messages appear.

## The number
On iPhone, open **Settings > Battery > Battery Health & Charging**. Apple designs its batteries to keep up to 80% capacity at 500 full cycles. Many Android phones show similar data in the battery or device-care menu.

## What to do
Under about 80% capacity, a battery replacement from an authorised centre often costs far less than a new phone. Ask for a receipt and log it in your passport.
$md$, 'maintenance', array['phone','battery','repair'], 'draft'),
('prepare-device-before-sell-or-gift', 'How to prepare a device before you sell or gift it',
 'A seven-step checklist so your data stays yours.', $md$
1. **Back up** photos, files and app data.
2. **Sign out** of your Apple ID, Google account and any cloud or password manager.
3. **Turn off Find My / Find My Device** so the next owner can activate it.
4. **Remove** SIM and memory cards.
5. **Factory reset** and confirm the setup screen appears.
6. **Gather proof**: invoice, box, charger, warranty details.
7. **Transfer the passport** so the history moves with the device.

## Be honest in the listing
List real battery health and any repairs. Buyers trust sellers who show records. Ownx lets you share a read-only passport link, or transfer the passport to the new owner's account.
$md$, 'guide', array['selling','gifting','privacy'], 'draft')
on conflict (slug) do nothing;
