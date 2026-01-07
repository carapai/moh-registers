import React, { useEffect, useState } from "react";
import { Select, Form, FormInstance } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import { db, Village } from "../db";
import { loadVillagesIfNeeded } from "../utils/village-loader";

interface WatchField {
    fieldId: string;
    label: string;
}

interface VillageSelectProps {
    value?: string;
    onChange?: (value: string) => void;
    form: FormInstance<any>;
    watchFields: WatchField[];
    indexKey?: string;
    filterFields?: string[];
    valueField?: keyof Village;
    labelField?: keyof Village;
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
    indexKey,
    filterFields,
    valueField = "village_name",
    labelField = "village_name",
    sortField = "village_name",
    allowDirectSearch = false,
    syncParentFields = false,
}: VillageSelectProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [searchMode, setSearchMode] = useState(true);

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

    // Watch all specified fields
    // const watchedValues = watchFields.map((field) =>
    //     Form.useWatch(field.fieldId, form),
    // );

    // Query all villages for search mode
    const villages = useLiveQuery(async () => {
        return await db.villages.orderBy(sortField).toArray();
    }, [allowDirectSearch, searchMode, sortField]);

    // Query villages based on watched fields
    // const villages = useLiveQuery(
    //     async () => {
    //         // If in search mode, show all villages
    //         if (allowDirectSearch && searchMode) {
    //             return allVillages;
    //         }

    //         // Check if all watched fields have values
    //         const allFieldsFilled = watchedValues.every(
    //             (val) => val != null && val !== "",
    //         );

    //         if (!allFieldsFilled) {
    //             // If direct search is allowed and no fields are filled, allow searching all
    //             if (allowDirectSearch) {
    //                 setSearchMode(true);
    //                 return [];
    //             }
    //             return [];
    //         }

    //         // Determine which index to use and how to filter
    //         if (indexKey && filterFields) {
    //             // Custom index and filter fields specified
    //             if (watchedValues.length === 1) {
    //                 // Single field filter
    //                 return await db.villages
    //                     .where(indexKey)
    //                     .equals(watchedValues[0])
    //                     .sortBy(sortField);
    //             } else {
    //                 // Compound index filter
    //                 return await db.villages
    //                     .where(indexKey)
    //                     .equals(watchedValues)
    //                     .sortBy(sortField);
    //             }
    //         } else {
    //             // Auto-detect index based on number of watched fields
    //             if (watchedValues.length === 1) {
    //                 // Single field - use District index
    //                 return await db.villages
    //                     .where("District")
    //                     .equals(watchedValues[0])
    //                     .sortBy(sortField);
    //             } else if (watchedValues.length === 2) {
    //                 // Two fields - use [District+subcounty_name] index
    //                 return await db.villages
    //                     .where("[District+subcounty_name]")
    //                     .equals(watchedValues)
    //                     .sortBy(sortField);
    //             } else if (watchedValues.length === 3) {
    //                 // Three fields - use [District+subcounty_name+parish_name] index
    //                 return await db.villages
    //                     .where("[District+subcounty_name+parish_name]")
    //                     .equals(watchedValues)
    //                     .sortBy(sortField);
    //             } else {
    //                 // More than 3 fields - filter manually
    //                 let results = await db.villages.toArray();

    //                 watchedValues.forEach((val, idx) => {
    //                     if (filterFields && filterFields[idx]) {
    //                         const field = filterFields[
    //                             idx
    //                         ] as keyof (typeof results)[0];
    //                         results = results.filter((v) => v[field] === val);
    //                     }
    //                 });

    //                 return results.sort((a, b) => {
    //                     const aVal = a[sortField as keyof typeof a];
    //                     const bVal = b[sortField as keyof typeof b];
    //                     return String(aVal).localeCompare(String(bVal));
    //                 });
    //             }
    //         }
    //     },
    //     [watchedValues.join("|"), indexKey, sortField],
    //     [],
    // );

    // Clear village when parent fields change
    // useEffect(() => {
    //     if (value && villages && villages.length > 0) {
    //         // Check if current value is still valid
    //         const isValid = villages.some(
    //             (v) => v[valueField  === value,
    //         );
    //         if (!isValid) {
    //             onChange?.("");
    //         }
    //     }
    // }, [watchedValues.join("|"), villages, value, onChange, valueField]);

    // Generate placeholder message
    const getPlaceholder = () => {
        // const emptyFields = watchFields.filter(
        //     (_, idx) => !watchedValues[idx] || watchedValues[idx] === "",
        // );

        // if (emptyFields.length > 0) {
        //     const fieldNames = emptyFields.map((f) => f.label).join(", ");
        //     return `Select ${fieldNames} first`;
        // }

        // if (villages?.length === 0) {
        //     return "No villages found";
        // }

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

    // const isDisabled =
    //     !allowDirectSearch &&
    //     (watchedValues.some((val) => !val || val === "") ||
    //         isLoading ||
    //         villages?.length === 0);

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
            showSearch
            virtual
            style={{ width: "100%" }}
            loading={isLoading}
            filterOption={(input, option) =>
                (option?.label ?? "")
                    .toLowerCase()
                    .includes(input.toLowerCase())
            }
        />
    );
}
