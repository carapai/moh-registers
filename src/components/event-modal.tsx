import {
    CalendarOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    LoadingOutlined,
    MedicineBoxOutlined,
} from "@ant-design/icons";
import {
    Button,
    Card,
    Col,
    DatePicker,
    Flex,
    Form,
    FormInstance,
    message,
    Modal,
    Row,
    Select,
    Space,
    Tabs,
    Typography,
} from "antd";
import dayjs from "dayjs";
import {
    calculateColSpan,
    createEmptyEvent,
    createGetValueProps,
    createNormalize,
} from "../utils/utils";

import { orderBy } from "lodash";
import React, { useCallback, useEffect, useState } from "react";
import { DataElementField } from "../components/data-element-field";
import { ProgramStageCapture } from "../components/program-stage-capture";
import RelationshipEvent from "../components/relationship-event";
import { db, FlattenedEvent, FlattenedTrackedEntity } from "../db";
import { useDexiePersistence } from "../hooks/useDexiePersistence";
import { useTrackerFormInit } from "../hooks/useTrackerFormInit";
import { useEventSyncStatus } from "../hooks/useEntitySyncStatus";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { RootRoute } from "../routes/__root";
import { TrackerRegistration } from "./tracker-registration";

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
export default function EventModal({
    currentEvent,
    trackedEntity,
    icon,
    visitForm,
    isNewEvent = false,
    label,
}: {
    currentEvent: FlattenedEvent;
    trackedEntity: FlattenedTrackedEntity;
    icon: React.ReactNode;
    visitForm: FormInstance;
    label: string;
    isNewEvent?: boolean;
}) {
    const {
        program,
        dataElements,
        optionGroups,
        optionSets,
        programRules,
        programRuleVariables,
    } = RootRoute.useLoaderData();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState<string>("");
    const [currentEventId, setCurrentEventId] = useState<string>("");
    const [isNestedModalOpen, setIsNestedModalOpen] = useState(false);
    const [childInitialAttributes, setChildInitialAttributes] = useState<
        Record<string, any>
    >({});
    const { syncStatus, syncError } = useEventSyncStatus(currentEventId);

    // Use unified persistence hook
    const {
        entity: currentEventFromDexie,
        updateField,
        updateFields,
    } = useDexiePersistence<FlattenedEvent>({
        entityType: "event",
        entityId: currentEventId,
    });

    // Use program rules with autoExecute enabled
    const { ruleResult, executeAndApplyRules, triggerAutoExecute } =
        useProgramRulesWithDexie({
            form: visitForm,
            programRules,
            programRuleVariables,
            programStage: "K2nxbE9ubSs",
            trackedEntityAttributes: trackedEntity.attributes,
            enrollment: trackedEntity.enrollment,
            onAssignments: updateFields,
            applyAssignmentsToForm: true,
            persistAssignments: true,
            program: program.id,
            autoExecute: true, // Enable automatic rule execution
        });

    // Wrap updateField to also trigger program rules
    const updateFieldWithRules = useCallback(
        (fieldId: string, value: any) => {
            updateField(fieldId, value);
            triggerAutoExecute();
        },
        [updateField, triggerAutoExecute],
    );

    // Use unified form initialization hook
    useTrackerFormInit({
        form: visitForm,
        entity: currentEventFromDexie,
        initialValues: {
            occurredAt: currentEventFromDexie?.occurredAt,
        },
        executeRules: executeAndApplyRules,
        enabled: isVisitModalOpen,
    });

    const getChildInitialAttributes = useCallback(() => {
        const formValues = visitForm.getFieldsValue();

        // Map data element values to child attributes
        const dataElementToAttributeMap: Record<string, string> = {
            KJ2V2JlOxFi: "Y3DE5CZWySr", // Birth date mapping
        };

        // Attributes to copy from parent
        const parentAttributesToCopy: string[] = [
            "XjgpfkoxffK",
            "W87HAtUHJjB",
            "PKuyTiVCR89",
            "oTI0DLitzFY",
        ];

        // Combined attributes from parent
        const combinedAttributes: Record<
            string,
            { sourceAttributes: string[]; separator?: string }
        > = {
            P6Kp91wfCWy: {
                sourceAttributes: ["KSq9EEZ8ZFi", "TWPNbc9O2nK"],
                separator: " ",
            },
            ACgDjRCyX8r: {
                sourceAttributes: ["hPGgzWsb14m"],
                separator: " ",
            },
        };

        const initialAttrs: Record<string, any> = {};

        // Copy parent attributes
        parentAttributesToCopy.forEach((attrId) => {
            if (trackedEntity.attributes?.[attrId]) {
                initialAttrs[attrId] = trackedEntity.attributes[attrId];
            }
        });

        // Map data element values to attributes
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
                    initialAttrs[attributeId] = value;
                }
            },
        );

        // Handle combined attributes
        Object.entries(combinedAttributes).forEach(([targetAttrId, config]) => {
            const values = config.sourceAttributes
                .map(
                    (attrId) =>
                        initialAttrs[attrId] ||
                        trackedEntity.attributes?.[attrId] ||
                        "",
                )
                .filter((v) => v);

            if (values.length > 0) {
                initialAttrs[targetAttrId] = values.join(
                    config.separator || " ",
                );
            }
        });

        return initialAttrs;
    }, [visitForm, trackedEntity.attributes]);
    useEffect(() => {
        const allValues = visitForm.getFieldsValue();
        if (allValues && allValues["REWqohCg4Km"] === "Yes") {
            const freshAttributes = getChildInitialAttributes();
            setChildInitialAttributes(freshAttributes);
            setIsNestedModalOpen(true);
        }
    }, [visitForm, getChildInitialAttributes]);

    const [serviceTypes, setServiceTypes] = useState<
        Array<{ id: string; name: string; code: string; optionSet: string }>
    >(optionSets.get("QwsvSPpnRul") ?? []);

    const handleModalClose = async () => {
        setIsVisitModalOpen(false);
        // Clear the current event ID to prevent stale data
        setCurrentEventId("");
        // Reset form when closing
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

    const [activeKey, setActiveKey] = useState<string>(
        "K2nxbE9ubSs-bnV62fxQmoE",
    );

    const handleTabChange = (active: string) => {
        setActiveKey(() => active);
        if (active === "K2nxbE9ubSs-L4STvAf43r1") {
        } else if (active === "K2nxbE9ubSs-Su5Ab8A9HCp") {
        }
    };

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
            await updateFields(finalValues);
            message.success({
                content: "Visit record saved successfully!",
                duration: 3,
            });
            visitForm.resetFields();
            setIsVisitModalOpen(false);
        } catch (error) {
            console.error("Error saving visit record:", error);
            message.error({
                content: "Failed to save visit record. Please try again.",
                duration: 5,
            });
        }
    };

    const showVisitModal = async () => {
        const eventToUse = isNewEvent
            ? createEmptyEvent({
                  program: trackedEntity.enrollment.program,
                  trackedEntity: trackedEntity.enrollment.trackedEntity,
                  enrollment: trackedEntity.enrollment.enrollment,
                  orgUnit: trackedEntity.enrollment.orgUnit,
                  programStage: "K2nxbE9ubSs",
              })
            : currentEvent;

        // Create event in Dexie if new
        if (isNewEvent) {
            await db.events.put({
                ...eventToUse,
                syncStatus: "draft",
                version: 1,
                lastModified: new Date().toISOString(),
            } as any);
        }

        setCurrentEventId(eventToUse.event);
        setModalKey(() => eventToUse.event);
        setIsVisitModalOpen(true);
    };
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

    return (
        <Flex>
            <Button
                icon={icon}
                onClick={() => {
                    showVisitModal();
                }}
            >
                {label}
            </Button>
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
                            {!isNewEvent && (
                                <Button
                                    danger
                                    onClick={() => {
                                        Modal.confirm({
                                            title: "Delete Event",
                                            content:
                                                "Are you sure you want to delete this event? This action cannot be undone.",
                                            okText: "Delete",
                                            okType: "danger",
                                            onOk: async () => {
                                                try {
                                                    await db.events.delete(
                                                        currentEvent.event,
                                                    );
                                                    message.success(
                                                        "Event deleted successfully",
                                                    );
                                                    setIsVisitModalOpen(false);
                                                } catch (error) {
                                                    console.error(
                                                        "Failed to delete event:",
                                                        error,
                                                    );
                                                    message.error(
                                                        "Failed to delete event",
                                                    );
                                                }
                                            },
                                        });
                                    }}
                                    style={{ borderRadius: 8 }}
                                >
                                    Delete
                                </Button>
                            )}
                            <CalendarOutlined
                                style={{ color: "#7c3aed", fontSize: 16 }}
                            />
                            <Text type="secondary" style={{ fontSize: 14 }}>
                                Visit Date:{" "}
                                <Text strong>
                                    {dayjs(
                                        visitForm.getFieldValue("occurredAt"),
                                    )?.format("MMM DD, YYYY") ?? "Not set"}
                                </Text>
                            </Text>
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
                                            onChange={() => {
                                                updateFieldWithRules(
                                                    "occurredAt",
                                                    visitForm.getFieldValue(
                                                        "occurredAt",
                                                    ),
                                                );
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
                                            onChange={() => {
                                                updateFieldWithRules(
                                                    "mrKZWf2WMIC",
                                                    visitForm.getFieldValue(
                                                        "mrKZWf2WMIC",
                                                    ),
                                                );
                                            }}
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
                                const currentDataElements = new Map(
                                    stage.programStageDataElements.map(
                                        (psde) => [
                                            psde.dataElement.id,
                                            {
                                                allowFutureDate:
                                                    psde.allowFutureDate,
                                                renderOptionsAsRadio:
                                                    psde.renderType !==
                                                    undefined,
                                                compulsory: psde.compulsory,
                                                desktopRenderType:
                                                    psde.renderType?.DESKTOP
                                                        ?.type,
                                            },
                                        ],
                                    ),
                                );

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
                                                mainEvent={
                                                    currentEventFromDexie ||
                                                    currentEvent
                                                }
                                                trackedEntity={trackedEntity}
                                                captureMode={
                                                    stage.id === "DA0Yt3V16AN"
                                                        ? "inline"
                                                        : "modal"
                                                }
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
                                                <Card>
                                                    <Row gutter={24}>
                                                        {section.dataElements.flatMap(
                                                            (dataElement) => {
                                                                const currentDataElement =
                                                                    dataElements.get(
                                                                        dataElement.id,
                                                                    );
                                                                const {
                                                                    compulsory = false,
                                                                    desktopRenderType,
                                                                } =
                                                                    currentDataElements.get(
                                                                        dataElement.id,
                                                                    ) || {};

                                                                const optionSet =
                                                                    currentDataElement
                                                                        ?.optionSet
                                                                        ?.id ??
                                                                    "";

                                                                const hiddenOptions =
                                                                    ruleResult
                                                                        .hiddenOptions[
                                                                        dataElement
                                                                            .id
                                                                    ];

                                                                const shownOptionGroups =
                                                                    ruleResult
                                                                        .shownOptionGroups[
                                                                        dataElement
                                                                            .id
                                                                    ] ||
                                                                    new Set<string>();

                                                                let finalOptions =
                                                                    optionSets
                                                                        .get(
                                                                            optionSet,
                                                                        )
                                                                        ?.flatMap(
                                                                            (
                                                                                o,
                                                                            ) => {
                                                                                if (
                                                                                    hiddenOptions?.has(
                                                                                        o.id,
                                                                                    )
                                                                                ) {
                                                                                    return [];
                                                                                }
                                                                                return o;
                                                                            },
                                                                        );

                                                                if (
                                                                    ruleResult.hiddenFields.has(
                                                                        dataElement.id,
                                                                    )
                                                                ) {
                                                                    return [];
                                                                }

                                                                if (
                                                                    shownOptionGroups.size >
                                                                    0
                                                                ) {
                                                                    const currentOptions =
                                                                        optionGroups.get(
                                                                            shownOptionGroups
                                                                                .values()
                                                                                .next()
                                                                                .value,
                                                                        ) ?? [];
                                                                    finalOptions =
                                                                        currentOptions.map(
                                                                            ({
                                                                                code,
                                                                                id,
                                                                                name,
                                                                            }) => ({
                                                                                id,
                                                                                code,
                                                                                name,
                                                                                optionSet,
                                                                            }),
                                                                        );
                                                                }

                                                                const errors =
                                                                    ruleResult.errors.filter(
                                                                        (msg) =>
                                                                            msg.key ===
                                                                            dataElement.id,
                                                                    );
                                                                const messages =
                                                                    ruleResult.messages.filter(
                                                                        (msg) =>
                                                                            msg.key ===
                                                                            dataElement.id,
                                                                    );
                                                                const warnings =
                                                                    ruleResult.warnings.filter(
                                                                        (msg) =>
                                                                            msg.key ===
                                                                            dataElement.id,
                                                                    );

                                                                return (
                                                                    <DataElementField
                                                                        dataElement={
                                                                            currentDataElement!
                                                                        }
                                                                        hidden={
                                                                            false
                                                                        }
                                                                        desktopRenderType={
                                                                            desktopRenderType!
                                                                        }
                                                                        finalOptions={
                                                                            finalOptions
                                                                        }
                                                                        messages={
                                                                            messages
                                                                        }
                                                                        warnings={
                                                                            warnings
                                                                        }
                                                                        errors={
                                                                            errors
                                                                        }
                                                                        required={
                                                                            compulsory
                                                                        }
                                                                        disabled={
                                                                            dataElement.id in
                                                                            ruleResult.assignments
                                                                        }
                                                                        key={
                                                                            dataElement.id
                                                                        }
                                                                        form={
                                                                            visitForm
                                                                        }
                                                                        xs={calculateColSpan(
                                                                            section
                                                                                .dataElements
                                                                                .length,
                                                                            24,
                                                                        )}
                                                                        sm={calculateColSpan(
                                                                            section
                                                                                .dataElements
                                                                                .length,
                                                                            24,
                                                                        )}
                                                                        md={calculateColSpan(
                                                                            section
                                                                                .dataElements
                                                                                .length,
                                                                            24,
                                                                        )}
                                                                        lg={calculateColSpan(
                                                                            section
                                                                                .dataElements
                                                                                .length,
                                                                            12,
                                                                        )}
                                                                        xl={calculateColSpan(
                                                                            section
                                                                                .dataElements
                                                                                .length,
                                                                            6,
                                                                        )}
                                                                        onAutoSave={
                                                                            updateFieldWithRules
                                                                        }
                                                                    />
                                                                );
                                                            },
                                                        )}
                                                    </Row>
                                                    {[
                                                        "Maternity",
                                                        "Postnatal",
                                                    ].includes(
                                                        section.name,
                                                    ) && (
                                                        <RelationshipEvent
                                                            section={
                                                                section.name
                                                            }
                                                            trackedEntity={
                                                                trackedEntity
                                                            }
                                                        />
                                                    )}
                                                </Card>
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
            <TrackerRegistration
                isModalOpen={isNestedModalOpen}
                setIsModalOpen={setIsNestedModalOpen}
                modalTitle="Child Registration"
                submitButtonText="Register Child"
                parentTrackedEntity={trackedEntity.trackedEntity}
                relationshipType="vDnDNhGRzzy"
                initialAttributes={childInitialAttributes}
                createNewEntity={true}
                onSuccess={(savedChild) => {
                    message.success({
                        content:
                            "Child registered and linked to mother successfully!",
                        duration: 3,
                    });
                }}
                canAddAnother={true}
            />
        </Flex>
    );
}
