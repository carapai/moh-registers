import { UserAddOutlined } from "@ant-design/icons";
import {
    Button,
    Card,
    Flex,
    Form,
    message,
    Modal,
    Row,
    Typography,
} from "antd";
import dayjs from "dayjs";
import React from "react";
import { db, FlattenedTrackedEntity } from "../db";
import { useDexieTrackedEntityForm } from "../hooks/useDexieTrackedEntityForm";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { RootRoute } from "../routes/__root";
import { RenderType } from "../schemas";
import { generateUid } from "../utils/id";
import {
    calculateColSpan,
    createEmptyTrackedEntity,
    spans,
} from "../utils/utils";
import { DataElementField } from "./data-element-field";

const { Text } = Typography;

export default function ChildModal({
    trackedEntity,
    formValues,
    setIsNestedModalOpen,
    isNestedModalOpen,
}: {
    trackedEntity: FlattenedTrackedEntity;
    formValues: any;
    setIsNestedModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
    isNestedModalOpen: boolean;
}) {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRules,
        programRuleVariables,
    } = RootRoute.useLoaderData();

    const [nestedForm] = Form.useForm();

    const { updateAttribute, updateAttributes } = useDexieTrackedEntityForm({
        trackedEntityId: trackedEntity.trackedEntity,
    });

    const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
        form: nestedForm,
        programRules,
        programRuleVariables,
        trackedEntityAttributes: trackedEntity?.attributes,
        enrollment: trackedEntity?.enrollment,
        onAssignments: updateAttributes,
        applyAssignmentsToForm: true,
        persistAssignments: false,
        clearHiddenFields: true,
        program: program.id,
        isRegistration: true,
        debounceMs: 300,
    });
    const allAttributes: Map<
        string,
        {
            mandatory: boolean;
            desktopRenderType?: RenderType;
        }
    > = new Map(
        program.programTrackedEntityAttributes.map(
            ({ mandatory, renderType, trackedEntityAttribute: { id } }) => [
                id,
                {
                    mandatory,
                    desktopRenderType: renderType?.DESKTOP,
                },
            ],
        ),
    );

    const dataElementToAttributeMap: Record<string, string> = {
        KJ2V2JlOxFi: "Y3DE5CZWySr",
    };
    const parentAttributesToCopy: string[] = [
        "XjgpfkoxffK",
        "W87HAtUHJjB",
        "PKuyTiVCR89",
        "oTI0DLitzFY",
    ];

    const attributeLabelOverrides: Record<string, string> = {};

    const combinedAttributes: Record<
        string,
        {
            sourceAttributes: string[];
            separator?: string;
        }
    > = {
        P6Kp91wfCWy: {
            sourceAttributes: ["KSq9EyZ8ZFi", "TWPNbc9O2nK"],
            separator: " ",
        },
        ACgDjRCyX8r: {
            sourceAttributes: ["hPGgzWsb14m"],
            separator: " ",
        },
    };

    const handleNestedFormSubmit = async (createAnother: boolean = false) => {
        try {
            const values = await nestedForm.validateFields();
            await handleNestedSubmit(values);
            closeNestedModal();

            if (createAnother) {
                openNestedModal();
            }
        } catch (error) {
            console.error(
                "❌ Nested form validation/submission failed:",
                error,
            );
            // Only show validation error if it's a validation error
            // Save errors are handled in createChildEntity
            if (error && typeof error === "object" && "errorFields" in error) {
                message.error({
                    content: "Please fill in all required fields",
                    duration: 3,
                });
            }
            // Don't close modal on error so user can retry
        }
    };

    const openNestedModal = () => {
        nestedForm.resetFields();
        const autoPopulatedAttributes: Record<string, any> = {};
        parentAttributesToCopy.forEach((attributeId) => {
            if (
                trackedEntity.attributes &&
                trackedEntity.attributes[attributeId]
            ) {
                autoPopulatedAttributes[attributeId] =
                    trackedEntity.attributes[attributeId];
            }
        });
        const mappedAttributes: Record<string, any> = {};
        Object.entries(dataElementToAttributeMap).forEach(
            ([dataElementId, attributeId]) => {
                if (formValues[dataElementId]) {
                    let value = formValues[dataElementId];
                    if (
                        value &&
                        typeof value === "object" &&
                        "format" in value
                    ) {
                        value = value.format("YYYY-MM-DD");
                    }

                    mappedAttributes[attributeId] = value;
                }
            },
        );

        // Handle combined attributes - populate target fields with combined values
        const combinedValues: Record<string, any> = {};
        Object.entries(combinedAttributes).forEach(([targetAttrId, config]) => {
            const values = config.sourceAttributes
                .map(
                    (attrId) =>
                        autoPopulatedAttributes[attrId] ||
                        mappedAttributes[attrId] ||
                        trackedEntity.attributes?.[attrId] ||
                        "",
                )
                .filter((v) => v); // Remove empty values

            if (values.length > 0) {
                // Combine values with separator and populate target attribute
                combinedValues[targetAttrId] = values.join(
                    config.separator || " ",
                );
            }
        });

        // Combine auto-populated and mapped attributes
        const initialValues = {
            ...autoPopulatedAttributes,
            ...mappedAttributes,
            ...combinedValues,
        };
        nestedForm.setFieldsValue(initialValues);
        setIsNestedModalOpen(true);
    };

    const closeNestedModal = () => {
        nestedForm.resetFields();
        setIsNestedModalOpen(false);
    };

    const handleNestedSubmit = async (values: any) => {
        try {
            console.log("📝 Child registration form values:", values);

            // Check if we have any values
            if (!values || Object.keys(values).length === 0) {
                console.error("❌ No form values provided!");
                message.error({
                    content: "No data to save. Please fill in the form.",
                    duration: 3,
                });
                return;
            }

            // Check for duplicate child (same birth date)
            const birthDate = values["Y3DE5CZWySr"]; // Birth date attribute
            // if (birthDate && mainEvent) {
            //     const existingRelationships =
            //         await populateRelationshipsForEntity(
            //             mainEvent.trackedEntity,
            //         );

            //     const duplicate = existingRelationships.find((rel) => {
            //         const child = rel.to.trackedEntity;
            //         // Check if child has attributes
            //         if (child.attributes) {
            //             // Handle both flattened format (object) and API format (array)
            //             const childBirthDate = Array.isArray(child.attributes)
            //                 ? child.attributes.find(
            //                       (a) => a.attribute === "Y3DE5CZWySr",
            //                   )?.value
            //                 : child.attributes["Y3DE5CZWySr"];
            //             return childBirthDate === birthDate;
            //         }
            //         return false;
            //     });

            //     if (duplicate) {
            //         // Show confirmation dialog
            //         Modal.confirm({
            //             title: "Possible Duplicate Child",
            //             content: `A child with birth date ${dayjs(birthDate).format("MMM DD, YYYY")} already exists. Do you want to continue?`,
            //             okText: "Continue Anyway",
            //             cancelText: "Cancel",
            //             onOk: async () => {
            //                 // User confirmed, proceed with creation
            //                 await createChildEntity(values);
            //             },
            //             onCancel: () => {
            //                 console.log(
            //                     "Child registration cancelled due to duplicate",
            //                 );
            //             },
            //         });
            //         return; // Exit early, will continue in modal callback if confirmed
            //     }
            // }

            // No duplicate, proceed with creation
            await createChildEntity(values);
        } catch (error) {
            console.error("❌ Error creating child:", error);
            message.error({
                content: `Failed to register child: ${error instanceof Error ? error.message : "Unknown error"}`,
                duration: 5,
            });
        }
    };

    // Extract child creation logic to separate function
    const createChildEntity = async (values: any) => {
        try {
            const childTrackedEntity = createEmptyTrackedEntity({
                orgUnit: trackedEntity.enrollment.orgUnit,
            });
            const newTrackedEntity: FlattenedTrackedEntity = {
                ...childTrackedEntity,
                attributes: values,
            };
            // setCurrentChildEntityId(newTrackedEntity.trackedEntity);
            const childForRelationship = {
                ...newTrackedEntity,
                attributes: Object.entries(values).map(
                    ([attribute, value]) => ({
                        attribute,
                        value: String(value),
                        valueType: "TEXT",
                        createdAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
                        updatedAt: dayjs().format("YYYY-MM-DDTHH:mm:ss.SSSZ"),
                    }),
                ),
                enrollments: [newTrackedEntity.enrollment],
            };
            const relationship = {
                relationship: generateUid(),
                relationshipType: "vDnDNhGRzzy",
                from: {
                    trackedEntity: {
                        trackedEntity: trackedEntity.trackedEntity || "",
                    },
                },
                to: {
                    trackedEntity: childForRelationship,
                },
            };

            newTrackedEntity.relationships = [relationship] as any;
            // await saveTrackedEntity(newTrackedEntity);

            const saved = await db.trackedEntities.get(
                newTrackedEntity.trackedEntity,
            );
            if (!saved) {
                throw new Error("Failed to save child to local database");
            }
            // trackerActor.send({
            //     type: "ADD_CHILD_RELATIONSHIP",
            //     relationship: relationship as any,
            // });
            message.success({
                content: "Child registered successfully!",
                duration: 3,
            });
        } catch (error) {
            console.error("❌ Error creating child:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to register child. Please try again.";
            message.error({
                content: errorMessage,
                duration: 5,
            });
            throw error;
        }
    };

		
    return (
        <Modal
            open={isNestedModalOpen}
            onCancel={closeNestedModal}
            centered
            title={
                <Flex align="center" gap="middle">
                    <div
                        style={{
                            width: 40,
                            height: 40,
                            borderRadius: "50%",
                            background:
                                "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#fff",
                        }}
                    >
                        <UserAddOutlined style={{ fontSize: 20 }} />
                    </div>
                    <Text strong style={{ fontSize: 18, color: "#1f2937" }}>
                        Child Registration
                    </Text>
                </Flex>
            }
            width="85vw"
            footer={
                <Flex
                    justify="space-between"
                    align="center"
                    style={{ padding: "8px 0" }}
                >
                    <Flex gap="middle">
                        <Button
                            onClick={closeNestedModal}
                            style={{ borderRadius: 8 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => handleNestedFormSubmit(false)}
                            style={{
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                borderColor: "#7c3aed",
                                borderRadius: 8,
                                fontWeight: 500,
                                paddingLeft: 32,
                                paddingRight: 32,
                            }}
                        >
                            Register Child & Exit
                        </Button>
                        <Button
                            type="primary"
                            onClick={() => handleNestedFormSubmit(true)}
                            style={{
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                borderColor: "#7c3aed",
                                borderRadius: 8,
                                fontWeight: 500,
                                paddingLeft: 32,
                                paddingRight: 32,
                            }}
                        >
                            Register Child & Add Another
                        </Button>
                    </Flex>
                </Flex>
            }
            styles={{
                body: {
                    maxHeight: "75vh",
                    overflow: "auto",
                },
                container: {
                    backgroundColor: "#f5f5f5",
                },
            }}
        >
            <Form
                form={nestedForm}
                layout="vertical"
                onFinish={handleNestedSubmit}
                style={{ margin: 0, padding: 0 }}
            >
                <Flex vertical gap={10}>
                    {program.programSections.map(
                        ({ name, trackedEntityAttributes: tei, id }) => (
                            <Card
                                title={name}
                                key={id}
                                style={{ borderRadius: 0 }}
                                size="small"
                            >
                                <Row gutter={[16, 0]}>
                                    {tei.map(({ id }) => {
                                        const current =
                                            trackedEntityAttributes.get(id);

                                        if (!current) {
                                            console.warn(
                                                `⚠️ Tracked entity attribute ${id} not found in trackedEntityAttributes map`,
                                            );
                                            return null;
                                        }

                                        const optionSet =
                                            current.optionSet?.id ?? "";
                                        const finalOptions =
                                            optionSets.get(optionSet);

                                        const attributeConfig =
                                            allAttributes.get(id);

                                        if (!attributeConfig) {
                                            console.warn(
                                                `⚠️ Attribute config for ${id} not found in allAttributes map`,
                                            );
                                            return null;
                                        }

                                        const { desktopRenderType, mandatory } =
                                            attributeConfig;

                                        return (
                                            <DataElementField
                                                key={id}
                                                dataElement={current}
                                                hidden={false}
                                                finalOptions={finalOptions}
                                                messages={[]}
                                                warnings={[]}
                                                errors={[]}
                                                required={mandatory}
                                                span={
                                                    spans.get(id) ||
                                                    calculateColSpan(
                                                        tei.length,
                                                        6,
                                                    )
                                                }
                                                onAutoSave={() => {}}
                                                form={nestedForm}
                                                customLabel={
                                                    attributeLabelOverrides[id]
                                                }
                                                desktopRenderType={
                                                    desktopRenderType?.type
                                                }
                                            />
                                        );
                                    })}
                                </Row>
                            </Card>
                        ),
                    )}
                </Flex>
            </Form>
        </Modal>
    );
}
