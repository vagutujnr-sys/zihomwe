export type LocationHierarchy = {
  province: string;
  provinceId: string;
  district: string;
  districtId: string;
  constituency: string;
  constituencyId: string;
  ward: string;
  wardId: string;
  wardNumber: number | null;
  cell: string;
  cellId: string;
};

type LocationRow = {
  id: string;
  name: string | null;
  province_id?: string | null;
  district_id?: string | null;
  constituency_id?: string | null;
  ward_id?: string | null;
  ward_number?: number | null;
};

type LocationClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => PromiseLike<{ data: LocationRow | null; error: unknown }>;
      };
    };
  };
};

async function findById(client: LocationClient, table: string, id: string | null | undefined, columns: string): Promise<LocationRow | null> {
  if (!id) return null;

  const { data, error } = await client.from(table).select(columns).eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function resolveLocationFromCell(client: unknown, cellId: string | null | undefined): Promise<LocationHierarchy | null> {
  if (!cellId) return null;
  const locationClient = client as LocationClient;

  const cell = await findById(locationClient, "cells", cellId, "id, name, province_id, district_id, constituency_id, ward_id");
  if (!cell) return null;

  const ward = await findById(locationClient, "wards", cell.ward_id, "id, name, province_id, district_id, constituency_id, ward_number");
  const constituencyId = ward?.constituency_id ?? cell.constituency_id;
  const constituency = await findById(locationClient, "constituencies", constituencyId, "id, name, province_id, district_id");
  const districtId = constituency?.district_id ?? ward?.district_id ?? cell.district_id;
  const district = await findById(locationClient, "districts", districtId, "id, name, province_id");
  const provinceId = district?.province_id ?? constituency?.province_id ?? ward?.province_id ?? cell.province_id;
  const province = await findById(locationClient, "provinces", provinceId, "id, name");

  return {
    province: province?.name ?? "",
    provinceId: province?.id ?? provinceId ?? "",
    district: district?.name ?? "",
    districtId: district?.id ?? districtId ?? "",
    constituency: constituency?.name ?? "",
    constituencyId: constituency?.id ?? constituencyId ?? "",
    ward: ward?.name ?? "",
    wardId: ward?.id ?? cell.ward_id ?? "",
    wardNumber: ward?.ward_number ?? null,
    cell: cell.name ?? "",
    cellId: cell.id,
  };
}
