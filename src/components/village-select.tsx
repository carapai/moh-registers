import { FormInstance, Select } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import React, { useState } from "react";
import { db, Village } from "../db";

interface WatchField {
    fieldId: string;
    label: string;
}

interface VillageSelectProps {
    value?: string;
    onChange?: (value: string) => void;
    form: FormInstance<any>;
    watchFields: WatchField[];
    filterFields?: string[];
    sortField?: keyof Village;
    allowDirectSearch?: boolean;
    syncParentFields?: boolean;
}

/**
 * Generic Village Selector Component
 *
 * Features:
 * - Watch multiple form fields for filtering
 * - Custom index key for optimized queries
 * - Custom field mappings for filter, value, and label
 * - Virtual scrolling for performance
 * - Lazy loading from IndexedDB
 *
 * @example
 * // Simple usage with District + Subcounty + Parish
 * <VillageSelect
 *   form={form}
 *   watchFields={[
 *     { fieldId: "DISTRICT_ID", label: "District" },
 *     { fieldId: "SUBCOUNTY_ID", label: "Subcounty" },
 *     { fieldId: "PARISH_ID", label: "Parish" }
 *   ]}
 * />
 *
 * @example
 * // Custom index and fields
 * <VillageSelect
 *   form={form}
 *   watchFields={[
 *     { fieldId: "DISTRICT_ID", label: "District" }
 *   ]}
 *   indexKey="District"
 *   filterFields={["District"]}
 *   valueField="village_id"
 *   labelField="village_name"
 *   sortField="village_name"
 * />
 *
 * @example
 * // Allow direct search and reverse sync
 * <VillageSelect
 *   form={form}
 *   watchFields={[
 *     { fieldId: "DISTRICT_ID", label: "District" },
 *     { fieldId: "SUBCOUNTY_ID", label: "Subcounty" },
 *     { fieldId: "PARISH_ID", label: "Parish" }
 *   ]}
 *   allowDirectSearch={true}
 *   syncParentFields={true}
 *   filterFields={["District", "subcounty_name", "parish_name"]}
 * />
 */
export default function VillageSelect({
    value,
    onChange,
    form,
    watchFields,
    filterFields,    
    sortField = "village_name",
    allowDirectSearch = false,
    syncParentFields = false,
}: VillageSelectProps) {
    const [searchMode, setSearchMode] = useState(true);

    const villages = useLiveQuery(async () => {
        return await db.villages.orderBy(sortField).toArray();
    }, [allowDirectSearch, searchMode, sortField]);

    const getPlaceholder = () => {
        return "Select Village";
    };

    // Handle village selection with reverse sync
    const handleVillageChange = async (selectedValue: string) => {
        onChange?.(selectedValue);

        // If sync is enabled, update parent fields
        if (syncParentFields && selectedValue) {
            try {
                // Find the selected village by value field
                const selectedVillage = villages?.find(
                    ({ village_id, village_name }) =>
                        `${village_id}(${village_name})` === selectedValue,
                );

                if (selectedVillage && filterFields) {
                    // Update parent fields based on filterFields mapping
                    filterFields.forEach((field, idx) => {
                        if (watchFields[idx]) {
                            const fieldValue =
                                selectedVillage[
                                    field as keyof typeof selectedVillage
                                ];
                            form.setFieldValue(
                                watchFields[idx].fieldId,
                                fieldValue,
                            );
                        }
                    });

                    // Exit search mode after selection
                    setSearchMode(false);
                } else if (selectedVillage && !filterFields) {
                    // Auto-detect fields based on default structure
                    if (watchFields.length === 3) {
                        form.setFieldValue(
                            watchFields[0].fieldId,
                            selectedVillage.District,
                        );
                        form.setFieldValue(
                            watchFields[1].fieldId,
                            selectedVillage.subcounty_name,
                        );
                        form.setFieldValue(
                            watchFields[2].fieldId,
                            selectedVillage.parish_name,
                        );
                    } else if (watchFields.length === 2) {
                        form.setFieldValue(
                            watchFields[0].fieldId,
                            selectedVillage.District,
                        );
                        form.setFieldValue(
                            watchFields[1].fieldId,
                            selectedVillage.subcounty_name,
                        );
                    } else if (watchFields.length === 1) {
                        form.setFieldValue(
                            watchFields[0].fieldId,
                            selectedVillage.District,
                        );
                    }
                    setSearchMode(false);
                }
            } catch (error) {
                console.error("Failed to sync parent fields:", error);
            }
        }
    };

    return (
        <Select
            placeholder={getPlaceholder()}
            value={value}
            onChange={handleVillageChange}
            options={villages?.map((v) => {
                const {
                    District,
                    subcounty_name,
                    parish_name,
                    village_id,
                    village_name,
                } = v;
                return {
                    value: `${village_id}(${village_name})`,
                    label: [District, subcounty_name, parish_name, village_name]
                        .filter(Boolean)
                        .join("/"),
                };
            })}
            showSearch={{
                filterOption: (input, option) =>
                    (option?.label ?? "")
                        .toLowerCase()
                        .includes(input.toLowerCase()),
            }}
            virtual
            style={{ width: "100%" }}
        />
    );
}
