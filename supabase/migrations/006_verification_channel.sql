-- ============================================================================
-- Migration 006 — Authentic "Verified" status
--
-- Verified now means: this specific device was signed into existence by a
-- real manufacturer, AND its ownership has never left the org-verified
-- network (manufacturer → seller-mediated sale → buyer). The moment it
-- changes hands through a plain owner-to-owner transfer (the existing
-- "Transfer to someone" flow, which anyone can send to any email with zero
-- verification), it downgrades — it's still the same real device, but Ownx
-- can no longer vouch for who currently holds it, only who used to.
--
-- Three states, computed from `devices.last_transfer_channel`:
--   'manufacturer' | 'seller'  -> Verified
--   'owner_resale'             -> Formerly Verified (ownership changed privately)
--   no linked devices row      -> Unverified (self-reported asset)
-- ============================================================================

alter table public.devices
  add column if not exists last_transfer_channel text not null default 'manufacturer'
  check (last_transfer_channel in ('manufacturer', 'seller', 'owner_resale'));

-- Seller-mediated sale (the actual verified handoff path) keeps it Verified.
create or replace function public.accept_device_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer record;
  v_device record;
  v_email text;
  v_new_asset_id uuid;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_transfer from public.device_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer is no longer pending';
  end if;
  if lower(v_transfer.to_email) <> lower(v_email) then
    raise exception 'This transfer was not sent to you';
  end if;

  select * into v_device from public.devices where id = v_transfer.device_id for update;
  if not found then
    raise exception 'Device not found';
  end if;

  if v_device.asset_id is null then
    insert into public.assets (
      owner_id, status, product_name, brand, category, image_url, serial_number,
      purchase_date, purchase_price, currency, warranty_months, extraction_source
    ) values (
      auth.uid(), 'active', v_device.product_name, v_device.brand, v_device.category, v_device.image_url,
      v_device.serial_number, current_date, v_transfer.sale_price, 'INR', v_device.warranty_months, 'manual'
    )
    returning id into v_new_asset_id;

    update public.devices set asset_id = v_new_asset_id where id = v_device.id;
  else
    update public.assets
      set owner_id = auth.uid(),
          purchase_price = coalesce(v_transfer.sale_price, purchase_price),
          purchase_date = current_date
      where id = v_device.asset_id;

    update public.listings set status = 'withdrawn' where asset_id = v_device.asset_id and status = 'active';
    update public.passport_shares set status = 'revoked' where asset_id = v_device.asset_id and status = 'active';
  end if;

  update public.device_transfers
    set status = 'accepted', to_user_id = auth.uid(), resolved_at = now()
    where id = p_transfer_id;

  update public.devices
    set current_owner_id = auth.uid(), status = 'active', last_transfer_channel = 'seller'
    where id = v_device.id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  values (v_device.id, 'ownership_transfer_accepted', 'confirmed', auth.uid(),
          'Ownership accepted', 'New owner accepted the passport transfer through a verified seller.');
end;
$$;

grant execute on function public.accept_device_transfer(uuid) to authenticated;

-- Owner-to-owner transfer (the plain "Transfer to someone" flow — nothing
-- stops anyone from typing in any email here) drops any linked device to
-- 'owner_resale', i.e. Formerly Verified going forward.
create or replace function public.accept_ownership_transfer(p_transfer_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_transfer record;
  v_email text;
begin
  v_email := auth.jwt() ->> 'email';
  if v_email is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_transfer from public.ownership_transfers where id = p_transfer_id for update;
  if not found then
    raise exception 'Transfer not found';
  end if;
  if v_transfer.status <> 'pending' then
    raise exception 'This transfer is no longer pending';
  end if;
  if lower(v_transfer.to_email) <> lower(v_email) then
    raise exception 'This transfer was not sent to you';
  end if;

  update public.ownership_transfers
    set status = 'accepted', to_user_id = auth.uid(), resolved_at = now()
    where id = p_transfer_id;

  update public.assets
    set owner_id = auth.uid()
    where id = v_transfer.asset_id;

  update public.listings
    set status = 'withdrawn'
    where asset_id = v_transfer.asset_id and status = 'active';

  update public.passport_shares
    set status = 'revoked'
    where asset_id = v_transfer.asset_id and status = 'active';

  update public.devices
    set current_owner_id = auth.uid(), last_transfer_channel = 'owner_resale'
    where asset_id = v_transfer.asset_id;

  insert into public.lifecycle_events (device_id, event_type, status, actor_user_id, title, detail)
  select id, 'ownership_transfer_accepted', 'documented', auth.uid(),
         'Ownership changed privately', 'Ownership transferred owner-to-owner, outside the verified seller network. Verification status downgraded.'
  from public.devices where asset_id = v_transfer.asset_id;
end;
$$;
