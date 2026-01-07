import React from "react";
import { Select, Space } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState } from "react";
import { db } from "../db";
import { loadVillagesIfNeeded } from "../utils/village-loader";

interface CascadingVillageSelectProps {
    value?: string;
    onChange?: (value: string) => void;
}

/**
 * Cascading Village Selector Component
 *
 * Provides 4-level hierarchical dropdown:
 * District → Subcounty → Parish → Village
 *
 * Features:
 * - Lazy loading from IndexedDB (loaded on mount)
 * - Virtual scrolling for performance
 * - Search/filter at each level
 * - Indexed queries for fast filtering (<20ms per level)
 * - Stores village name as value
 */
export default function CascadingVillageSelect({
    value,
    onChange,
}: CascadingVillageSelectProps) {
    const [district, setDistrict] = useState<string | null>(null);
    const [subcounty, setSubcounty] = useState<string | null>(null);
    const [parish, setParish] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Load villages on component mount
    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            try {
                await loadVillagesIfNeeded();
            } catch (error) {
                console.error("Failed to load villages:", error);
            } finally {
                setIsLoading(false);
            }
        };
        init();
    }, []);

    // Query districts (cached, ~135 unique districts in Uganda)
    const districts = useLiveQuery(async () => {
        const keys = await db.villages.orderBy("District").uniqueKeys();
        return (keys as string[]).sort();
    }, []);

    // Query subcounties filtered by district
    const subcounties = useLiveQuery(
        async () => {
            if (!district) return [];
            const villages = await db.villages
                .where("District")
                .equals(district)
                .toArray();
            const unique = [
                ...new Set(villages.map((v) => v.subcounty_name)),
            ].sort();
            return unique;
        },
        [district],
        [],
    );

    // Query parishes filtered by district + subcounty
    const parishes = useLiveQuery(
        async () => {
            if (!district || !subcounty) return [];
            const villages = await db.villages
                .where("[District+subcounty_name]")
                .equals([district, subcounty])
                .toArray();
            const unique = [
                ...new Set(villages.map((v) => v.parish_name)),
            ].sort();
            return unique;
        },
        [district, subcounty],
        [],
    );

    // Query villages filtered by all three levels
    const villages = useLiveQuery(
        async () => {
            if (!district || !subcounty || !parish) return [];
            return await db.villages
                .where("[District+subcounty_name+parish_name]")
                .equals([district, subcounty, parish])
                .sortBy("village_name");
        },
        [district, subcounty, parish],
        [],
    );

    // Reset child selections when parent changes
    const handleDistrictChange = (val: string) => {
        setDistrict(val);
        setSubcounty(null);
        setParish(null);
        onChange?.("");
    };

    const handleSubcountyChange = (val: string) => {
        setSubcounty(val);
        setParish(null);
        onChange?.("");
    };

    const handleParishChange = (val: string) => {
        setParish(val);
        onChange?.("");
    };

    const handleVillageChange = (val: string) => {
        onChange?.(val);
    };

    return (
        <Space direction="vertical" style={{ width: "100%" }}>
            <Select
                placeholder="Select District"
                value={district}
                onChange={handleDistrictChange}
                options={districts?.map((d) => ({ value: d, label: d }))}
                showSearch
                style={{ width: "100%" }}
                loading={isLoading}
                disabled={isLoading}
                filterOption={(input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }
            />

            <Select
                placeholder="Select Subcounty"
                value={subcounty}
                onChange={handleSubcountyChange}
                options={subcounties?.map((s) => ({ value: s, label: s }))}
                disabled={!district || isLoading}
                showSearch
                style={{ width: "100%" }}
                filterOption={(input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }
            />

            <Select
                placeholder="Select Parish"
                value={parish}
                onChange={handleParishChange}
                options={parishes?.map((p) => ({ value: p, label: p }))}
                disabled={!subcounty || isLoading}
                showSearch
                style={{ width: "100%" }}
                filterOption={(input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }
            />

            <Select
                placeholder="Select Village"
                value={value}
                onChange={handleVillageChange}
                options={villages?.map((v) => ({
                    value: v.village_name,
                    label: v.village_name,
                }))}
                disabled={!parish || isLoading}
                showSearch
                virtual
                style={{ width: "100%" }}
                filterOption={(input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase())
                }
            />
        </Space>
    );
}
