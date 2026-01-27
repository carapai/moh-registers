import {
    CalendarOutlined,
    CaretRightOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    EyeOutlined,
    LoadingOutlined,
    MedicineBoxOutlined,
    PlusOutlined,
    UserAddOutlined,
} from "@ant-design/icons";
import { createRoute } from "@tanstack/react-router";
import type { DescriptionsProps, TableProps } from "antd";
import {
    Button,
    Card,
    Col,
    Collapse,
    DatePicker,
    Descriptions,
    Flex,
    Form,
    message,
    Modal,
    Row,
    Select,
    Space,
    Splitter,
    Table,
    Tabs,
    Tag,
    Typography,
} from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import { orderBy } from "lodash";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataElementField } from "../components/data-element-field";
import { ProgramStageCapture } from "../components/program-stage-capture";
import SectionCapture from "../components/section-capture";
import { db, FlattenedEvent } from "../db";
import {
    populateRelationshipsForEntity,
    saveTrackedEntity,
} from "../db/operations";
import { useDexieEventForm } from "../hooks/useDexieEventForm";
import {
    useEntitySyncStatus,
    useEventSyncStatus,
} from "../hooks/useEntitySyncStatus";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { TrackerContext } from "../machines/tracker";
import { RenderType } from "../schemas";
import { generateUid } from "../utils/id";
import {
    calculateColSpan,
    createEmptyEvent,
    createEmptyTrackedEntity,
    createGetValueProps,
    createNormalize,
    flattenTrackedEntity,
    spans,
} from "../utils/utils";
import { RootRoute } from "./__root";
export const TrackedEntityRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entity/$trackedEntity",
    component: TrackedEntity,
});

const { Text } = Typography;

const stages: Map<string, number> = new Map([
    ["x5x1cHHjg00", 7],
    ["opwSN351xGC", 5],
    ["dyt37jxHYGv", 6],
    ["VzKe0OzKS8O", 1],
    ["zKGWob5AZKP", 3],
    ["K2nxbE9ubSs", 2],
    ["DA0Yt3V16AN", 4],
    ["wmPg6qplttg", 8],
]);

function TrackedEntity() {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRules,
        programRuleVariables,
        programOrgUnits,
    } = RootRoute.useLoaderData();
    const trackerActor = TrackerContext.useActorRef();
    const orgUnit = TrackerContext.useSelector(
        (state) => state.context.orgUnit.id,
    );
    const [serviceTypes, setServiceTypes] = useState<
        Array<{ id: string; name: string; code: string; optionSet: string }>
    >(optionSets.get("QwsvSPpnRul") ?? []);

    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    const mainEvent = TrackerContext.useSelector(
        (state) => state.context.mainEvent,
    );

    const enrollment = trackedEntity.enrollment;

    const attributes = Array.from(trackedEntityAttributes.values());

    const keys: Map<string, string> = new Map(
        attributes?.map((attr) => [
            attr.id,
            attr.displayFormName || attr.name || "",
        ]),
    );

    const relationships = useLiveQuery(async () => {
        if (!trackedEntity.trackedEntity) return [];

        try {
            return await populateRelationshipsForEntity(
                trackedEntity.trackedEntity,
            );
        } catch (error) {
            console.error("Failed to load relationships:", error);
            return [];
        }
    }, [trackedEntity.trackedEntity]);

    useEffect(() => {
        if (relationships && relationships.length > 0) {
            trackerActor.send({
                type: "SET_RELATIONSHIPS",
                relationships: relationships,
            });
        }
    }, [relationships, trackerActor]);

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

    const [visitForm] = Form.useForm();

    const { updateDataValue, updateDataValues, markEventReady } =
        useDexieEventForm({
            currentEvent: mainEvent,
        });

    const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
        form: visitForm,
        programRules,
        programRuleVariables,
        programStage: "K2nxbE9ubSs",
        trackedEntityAttributes: trackedEntity.attributes,
        enrollment: trackedEntity.enrollment,
        onAssignments: updateDataValues,
        applyAssignmentsToForm: true,
        persistAssignments: true,
        program: program.id,
    });

    const { syncStatus, syncError } = useEventSyncStatus(mainEvent.event);
    const events =
        useLiveQuery(async () => {
            if (!trackedEntity.trackedEntity) return [];
            return await db.events
                .where("trackedEntity")
                .equals(trackedEntity.trackedEntity)
                .and((e) => e.programStage === "K2nxbE9ubSs")
                .toArray();
        }, [trackedEntity.trackedEntity]) || [];

    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState<string>("");
    const [currentVisitDate, setCurrentVisitDate] = useState<string | null>(
        null,
    );
    const [isNestedModalOpen, setIsNestedModalOpen] = useState(false);
    const [nestedModalKey, setNestedModalKey] = useState(0);
    const [nestedForm] = Form.useForm();
    const [currentChildEntityId, setCurrentChildEntityId] = useState<
        string | null
    >(null);

    const { syncStatus: childSyncStatus, syncError: childSyncError } =
        useEntitySyncStatus(currentChildEntityId);

    const onVisitSubmit = async (values: Record<string, any>) => {
        if (ruleResult.errors.length > 0) {
            console.error(
                "Form has validation errors from program rules:",
                ruleResult.errors,
            );
            message.error({
                content: `Validation failed: ${ruleResult.errors.map((e) => e.content).join(", ")}`,
                duration: 5,
            });
            return;
        }
        try {
            const { occurredAt, ...dataValues } = values;
            const finalValues = {
                ...dataValues,
                ...ruleResult.assignments,
            };
            await updateDataValues(finalValues);
            message.success({
                content: "Visit record saved successfully!",
                duration: 3,
            });
            visitForm.resetFields();
            trackerActor.send({ type: "RESET_MAIN_EVENT" });
            setIsVisitModalOpen(false);
        } catch (error) {
            console.error("Error saving visit record:", error);
            message.error({
                content: "Failed to save visit record. Please try again.",
                duration: 5,
            });
        }
    };

    const showVisitModal = (visit: FlattenedEvent) => {
        visitForm.resetFields();
        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: visit });
        setModalKey(() => visit.event);
        setIsVisitModalOpen(true);
    };

    const showCreateVisitModal = async () => {
        visitForm.resetFields();
        const emptyEvent = createEmptyEvent({
            program: enrollment.program,
            trackedEntity: enrollment.trackedEntity,
            enrollment: enrollment.enrollment,
            orgUnit: enrollment.orgUnit,
            programStage: "K2nxbE9ubSs",
        });
        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: emptyEvent });
        setModalKey(() => emptyEvent.event);
        setIsVisitModalOpen(true);
    };

    const handleModalClose = async () => {
        setIsVisitModalOpen(false);
        trackerActor.send({ type: "RESET_MAIN_EVENT" });
        visitForm.resetFields();
    };

    const handleSubmit = async () => {
        try {
            await visitForm.validateFields();
            visitForm.submit();
        } catch (error) {
            console.error("Form validation failed:", error);
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
        const currentFormValues = visitForm.getFieldsValue();
        const mappedAttributes: Record<string, any> = {};
        Object.entries(dataElementToAttributeMap).forEach(
            ([dataElementId, attributeId]) => {
                if (currentFormValues[dataElementId]) {
                    let value = currentFormValues[dataElementId];
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
        setNestedModalKey((prev) => prev + 1);
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
                orgUnit: enrollment.orgUnit,
            });
            const newTrackedEntity: ReturnType<typeof flattenTrackedEntity> = {
                ...childTrackedEntity,
                attributes: values,
            };
            setCurrentChildEntityId(newTrackedEntity.trackedEntity);
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
                        trackedEntity: mainEvent?.trackedEntity || "",
                    },
                },
                to: {
                    trackedEntity: childForRelationship,
                },
            };

            newTrackedEntity.relationships = [relationship] as any;
            await saveTrackedEntity(newTrackedEntity);

            const saved = await db.trackedEntities.get(
                newTrackedEntity.trackedEntity,
            );
            if (!saved) {
                throw new Error("Failed to save child to local database");
            }
            trackerActor.send({
                type: "ADD_CHILD_RELATIONSHIP",
                relationship: relationship as any,
            });
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
            throw error; // Re-throw to prevent modal from closing
        }
    };

    const [shouldCreateAnotherChild, setShouldCreateAnotherChild] =
        useState(false);

    const handleNestedFormSubmit = async (createAnother: boolean = false) => {
        try {
            setShouldCreateAnotherChild(createAnother);

            const allFieldValues = nestedForm.getFieldsValue();

            const values = await nestedForm.validateFields();
            await handleNestedSubmit(values);

            closeNestedModal();

            if (shouldCreateAnotherChild) {
                setShouldCreateAnotherChild(false);
                openNestedModal();
            }
        } catch (error) {
            console.error(
                "❌ Nested form validation/submission failed:",
                error,
            );
            // Reset the flag if validation or submission fails
            setShouldCreateAnotherChild(false);

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
    // ✅ OPTIMIZED: Memoized columns prevent Table re-renders
    const columns: TableProps<FlattenedEvent>["columns"] = useMemo(
        () => [
            {
                title: "Date",
                dataIndex: "occurredAt",
                key: "date",
                render: (date) => dayjs(date).format("MMM DD, YYYY"),
            },
            {
                title: "Services",
                dataIndex: ["dataValues", "mrKZWf2WMIC"],
                key: "services",
                render: (text) => {
                    if (!text || typeof text !== "string") return null;
                    return (
                        <Flex gap="small" align="center" wrap>
                            {text.split(",").map((tag) => {
                                return (
                                    <Tag key={tag} color="blue">
                                        {tag.toUpperCase()}
                                    </Tag>
                                );
                            })}
                        </Flex>
                    );
                },
            },
            {
                title: "Action",
                key: "action",
                width: 100,
                render: (_, record) => (
                    <Button
                        icon={<EyeOutlined />}
                        onClick={() => {
                            showVisitModal(record);
                        }}
                    >
                        View
                    </Button>
                ),
            },
        ],
        [],
    );
    const items: DescriptionsProps["items"] = Object.entries(
        trackedEntity.attributes || {},
    ).map(([key, value]) => ({
        key: key,
        label: keys.get(key) || key,
        children: <Text>{String(value)}</Text>,
    }));

    const handleTriggerProgramRules = useCallback(() => {
        const allValues = visitForm.getFieldsValue();
        const _changed = allValues;
        if (_changed && _changed["REWqohCg4Km"] === "Yes") {
            openNestedModal();
        }
        executeAndApplyRules();
    }, [visitForm, executeAndApplyRules]);

    useEffect(() => {
        if (ruleResult.hiddenOptions["mrKZWf2WMIC"]?.size > 0) {
            setServiceTypes((prev) =>
                prev.flatMap((o) => {
                    if (ruleResult.hiddenOptions["mrKZWf2WMIC"].has(o.id)) {
                        return [];
                    }
                    return o;
                }),
            );
        }
    }, [ruleResult.hiddenOptions["mrKZWf2WMIC"], isVisitModalOpen]);

    const [activeKey, setActiveKey] = useState<string>(
        "K2nxbE9ubSs-bnV62fxQmoE",
    );

    const handleTabChange = (active: string) => {
        setActiveKey(() => active);
        if (active === "K2nxbE9ubSs-L4STvAf43r1") {
        } else if (active === "K2nxbE9ubSs-Su5Ab8A9HCp") {
        }
    };

    return (
        <>
            <Splitter style={{ height: "calc(100vh - 48px)" }}>
                <Splitter.Panel style={{ padding: 10 }}>
                    <Flex vertical gap="16px">
                        <Flex>
                            <Button
                                onClick={() => {
                                    visitForm.resetFields();
                                    trackerActor.send({
                                        type: "RESET_MAIN_EVENT",
                                    });
                                    trackerActor.send({
                                        type: "RESET_TRACKED_ENTITY",
                                    });
                                    trackerActor.send({ type: "GO_BACK" });
                                }}
                            >
                                Back
                            </Button>
                        </Flex>
                        <Card
                            title={
                                <Space>
                                    <CalendarOutlined />
                                    <span>Patient Visits</span>
                                    {!navigator.onLine && (
                                        <Tag color="orange">Offline</Tag>
                                    )}
                                </Space>
                            }
                            extra={
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={showCreateVisitModal}
                                    disabled={!programOrgUnits.has(orgUnit)}
                                >
                                    Add Visit
                                </Button>
                            }
                        >
                            <Table
                                columns={columns}
                                dataSource={events}
                                pagination={false}
                                rowKey="event"
                                scroll={{ x: "max-content" }}
                            />
                        </Card>
                    </Flex>
                </Splitter.Panel>

                <Splitter.Panel
                    defaultSize="25%"
                    collapsible={{
                        start: true,
                        end: true,
                        showCollapsibleIcon: true,
                    }}
                    style={{ padding: 10 }}
                >
                    <Flex vertical gap="16px">
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "2",
                                    label: "Notes about this enrollment",
                                    children: <p></p>,
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                        />
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "1",
                                    label: "Person Profile",
                                    children: (
                                        <Descriptions
                                            bordered
                                            column={1}
                                            items={items}
                                        />
                                    ),
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                            styles={{ body: { padding: 0, margin: 0 } }}
                        />
                        <Collapse
                            expandIcon={({ isActive }) => (
                                <CaretRightOutlined
                                    rotate={isActive ? 90 : 0}
                                />
                            )}
                            items={[
                                {
                                    key: "2",
                                    label: "Enrollment",
                                    children: (
                                        <Descriptions
                                            column={1}
                                            items={[
                                                {
                                                    label: "Enrollment Date",
                                                    children: (
                                                        <Text>
                                                            {
                                                                enrollment?.enrolledAt
                                                            }
                                                        </Text>
                                                    ),
                                                },
                                                {
                                                    label: "Status",
                                                    children: (
                                                        <Text>
                                                            {enrollment?.status}
                                                        </Text>
                                                    ),
                                                },
                                            ]}
                                        />
                                    ),
                                    extra: <Button>Edit</Button>,
                                },
                            ]}
                        />
                    </Flex>
                </Splitter.Panel>
            </Splitter>
            <Modal
                key={modalKey}
                title={
                    <Flex align="center" gap="middle">
                        <div
                            style={{
                                width: 36,
                                height: 36,
                                borderRadius: "50%",
                                background:
                                    "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                            }}
                        >
                            <MedicineBoxOutlined style={{ fontSize: 18 }} />
                        </div>
                        <Text strong style={{ fontSize: 18 }}>
                            Visit
                        </Text>
                    </Flex>
                }
                open={isVisitModalOpen}
                onCancel={handleModalClose}
                footer={
                    <Flex
                        justify="space-between"
                        align="center"
                        style={{ padding: "12px 0" }}
                    >
                        <Flex align="center" gap="middle">
                            <CalendarOutlined
                                style={{ color: "#7c3aed", fontSize: 16 }}
                            />
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                Visit Date:{" "}
                                <Text strong>
                                    {currentVisitDate
                                        ? dayjs(currentVisitDate).format(
                                              "MMM DD, YYYY",
                                          )
                                        : "Not set"}
                                </Text>
                            </Text>

                            {/* Sync status indicator */}
                            {syncStatus && syncStatus !== "draft" && (
                                <Flex align="center" gap="small">
                                    {syncStatus === "synced" && (
                                        <>
                                            <CheckCircleOutlined
                                                style={{ color: "#52c41a" }}
                                            />
                                            <Text
                                                type="success"
                                                style={{ fontSize: 12 }}
                                            >
                                                Synced
                                            </Text>
                                        </>
                                    )}
                                    {syncStatus === "pending" && (
                                        <>
                                            <CheckCircleOutlined
                                                style={{ color: "#1890ff" }}
                                            />
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: "#1890ff",
                                                }}
                                            >
                                                Saved (pending sync)
                                            </Text>
                                        </>
                                    )}
                                    {syncStatus === "syncing" && (
                                        <>
                                            <LoadingOutlined
                                                style={{ color: "#1890ff" }}
                                            />
                                            <Text
                                                style={{
                                                    fontSize: 12,
                                                    color: "#1890ff",
                                                }}
                                            >
                                                Syncing...
                                            </Text>
                                        </>
                                    )}
                                    {syncStatus === "failed" && (
                                        <>
                                            <ExclamationCircleOutlined
                                                style={{ color: "#faad14" }}
                                            />
                                            <Text
                                                type="warning"
                                                style={{ fontSize: 12 }}
                                            >
                                                {syncError || "Sync failed"}
                                            </Text>
                                        </>
                                    )}
                                </Flex>
                            )}
                        </Flex>
                        <Space size="middle">
                            <Button
                                onClick={handleModalClose}
                                style={{ borderRadius: 8 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
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
                                Save and complete Visit
                            </Button>
                        </Space>
                    </Flex>
                }
                width="95vw"
                styles={{
                    body: {
                        maxHeight: "75vh",
                        margin: 0,
                        padding: 0,
                    },
                    container: {
                        background: "#f5f5f5",
                    },
                }}
                centered
                destroyOnHidden
            >
                <Form
                    form={visitForm}
                    layout="vertical"
                    onFinish={onVisitSubmit}
                    style={{ margin: 0, padding: 0 }}
                    initialValues={{
                        ...mainEvent?.dataValues,
                        occurredAt: mainEvent?.occurredAt,
                    }}
                >
                    <Flex vertical gap={10} style={{ width: "100%" }}>
                        <Card
                            size="small"
                            styles={{ body: { padding: 10, margin: 0 } }}
                        >
                            <Row gutter={20}>
                                <Col span={12}>
                                    <Form.Item
                                        label="Visit Date"
                                        name="occurredAt"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Please select visit date!",
                                            },
                                        ]}
                                        getValueProps={createGetValueProps(
                                            "DATE",
                                        )}
                                        normalize={createNormalize("DATE")}
                                    >
                                        <DatePicker
                                            style={{ width: "100%" }}
                                            placeholder="Select date"
                                            onChange={(date) => {
                                                if (date) {
                                                    setCurrentVisitDate(
                                                        date.format(
                                                            "YYYY-MM-DD",
                                                        ),
                                                    );
                                                } else {
                                                    setCurrentVisitDate(null);
                                                }
                                                handleTriggerProgramRules();
                                            }}
                                        />
                                    </Form.Item>
                                </Col>
                                <Col span={12}>
                                    <Form.Item
                                        label="Service Type"
                                        name="mrKZWf2WMIC"
                                        rules={[
                                            {
                                                required: true,
                                                message:
                                                    "Please select service type!",
                                            },
                                        ]}
                                        getValueProps={createGetValueProps(
                                            "MULTI_TEXT",
                                        )}
                                        normalize={createNormalize(
                                            "MULTI_TEXT",
                                        )}
                                    >
                                        <Select
                                            style={{ width: "100%" }}
                                            options={serviceTypes}
                                            fieldNames={{
                                                label: "name",
                                                value: "code",
                                            }}
                                            allowClear
                                            mode="multiple"
                                            placeholder="Select services"
                                            showSearch={{
                                                filterOption: (
                                                    input,
                                                    option,
                                                ) =>
                                                    option
                                                        ? option.name
                                                              .toLowerCase()
                                                              .includes(
                                                                  input.toLowerCase(),
                                                              ) ||
                                                          option.code
                                                              .toLowerCase()
                                                              .includes(
                                                                  input.toLowerCase(),
                                                              )
                                                        : false,
                                            }}
                                            onChange={handleTriggerProgramRules}
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>
                        <Tabs
                            tabPlacement="start"
                            items={orderBy(
                                program.programStages.map((a) => ({
                                    ...a,
                                    sortOrder: stages.get(a.id),
                                })),
                                "sortOrder",
                                "asc",
                            ).flatMap((stage) => {
                                if (stage.id === "opwSN351xGC") {
                                    return [];
                                }
                                if (
                                    [
                                        "opwSN351xGC",
                                        "zKGWob5AZKP",
                                        "DA0Yt3V16AN",
                                    ].includes(stage.id)
                                ) {
                                    return {
                                        key: stage.id,
                                        label: stage.name,
                                        children: (
                                            <ProgramStageCapture
                                                programStage={stage}
                                            />
                                        ),
                                    };
                                }
                                return orderBy(
                                    stage.programStageSections,
                                    ["sortOrder"],
                                    ["asc"],
                                ).flatMap((section) => {
                                    if (
                                        ruleResult.hiddenSections.has(
                                            section.id,
                                        )
                                    )
                                        return [];

                                    return [
                                        {
                                            key: `${stage.id}-${section.id}`,
                                            label:
                                                section.displayName ||
                                                section.name,
                                            children: (
                                                <SectionCapture
                                                    section={section}
                                                    stage={stage}
                                                    ruleResult={ruleResult}
                                                    form={visitForm}
                                                    handleTriggerProgramRules={
                                                        handleTriggerProgramRules
                                                    }
                                                    updateDataValue={
                                                        updateDataValue
                                                    }
                                                />
                                            ),
                                        },
                                    ];
                                });
                            })}
                            tabBarStyle={{
                                background: "#fff",
                                borderRadius: 0,
                            }}
                            styles={{
                                content: {
                                    maxHeight: "63vh",
                                    overflow: "auto",
                                    padding: 0,
                                    margin: 0,
                                    borderRadius: 0,
                                    marginLeft: 8,
                                },
                                header: {
                                    maxHeight: "63vh",
                                    overflow: "auto",
                                },
                            }}
                            onChange={handleTabChange}
                            activeKey={activeKey}
                        />
                    </Flex>
                </Form>
            </Modal>
            <Modal
                key={nestedModalKey}
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
                        {childSyncStatus && childSyncStatus !== "draft" && (
                            <Flex align="center" gap="small">
                                {childSyncStatus === "synced" && (
                                    <>
                                        <CheckCircleOutlined
                                            style={{ color: "#52c41a" }}
                                        />
                                        <Text
                                            type="success"
                                            style={{ fontSize: 12 }}
                                        >
                                            Synced
                                        </Text>
                                    </>
                                )}
                                {childSyncStatus === "pending" && (
                                    <>
                                        <CheckCircleOutlined
                                            style={{ color: "#1890ff" }}
                                        />
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                color: "#1890ff",
                                            }}
                                        >
                                            Saved (pending sync)
                                        </Text>
                                    </>
                                )}
                                {childSyncStatus === "syncing" && (
                                    <>
                                        <CheckCircleOutlined
                                            style={{ color: "#1890ff" }}
                                        />
                                        <Text
                                            style={{
                                                fontSize: 12,
                                                color: "#1890ff",
                                            }}
                                        >
                                            Syncing...
                                        </Text>
                                    </>
                                )}
                                {childSyncStatus === "failed" && (
                                    <>
                                        <ExclamationCircleOutlined
                                            style={{ color: "#faad14" }}
                                        />
                                        <Text
                                            type="warning"
                                            style={{ fontSize: 12 }}
                                        >
                                            {childSyncError || "Sync failed"}
                                        </Text>
                                    </>
                                )}
                            </Flex>
                        )}
                        {(!childSyncStatus || childSyncStatus === "draft") && (
                            <div />
                        )}
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

                                            const {
                                                desktopRenderType,
                                                mandatory,
                                            } = attributeConfig;

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
                                                    onTriggerProgramRules={() => {}}
                                                    onAutoSave={() => {}}
                                                    form={nestedForm}
                                                    customLabel={
                                                        attributeLabelOverrides[
                                                            id
                                                        ]
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
        </>
    );
}
