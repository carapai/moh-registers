import {
    CalendarOutlined,
    CaretRightOutlined,
    EyeOutlined,
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
    Modal,
    Row,
    Select,
    Space,
    Splitter,
    Table,
    Tabs,
    Tag,
    Typography,
    message,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useMemo, useState } from "react";
import { DataElementField } from "../components/data-element-field";
import { ProgramStageCapture } from "../components/program-stage-capture";
import { FlattenedEvent } from "../db";
import { useTrackerState } from "../hooks/useTrackerState";
import { TrackerContext } from "../machines/tracker";
import {
    createEmptyEvent,
    createEmptyTrackedEntity,
    createGetValueProps,
    createNormalize,
    flattenTrackedEntity,
} from "../utils/utils";
import { RootRoute } from "./__root";
export const TrackedEntityRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entity/$trackedEntity",
    component: TrackedEntity,
});

const { Text } = Typography;

function TrackedEntity() {
    const {
        program,
        dataElements,
        optionGroups,
        trackedEntityAttributes,
        optionSets,
        programRules,
        programRuleVariables,
    } = RootRoute.useLoaderData();
    const trackerActor = TrackerContext.useActorRef();
    const [serviceTypes, setServiceTypes] = useState<
        Array<{ id: string; name: string; code: string; optionSet: string }>
    >(optionSets.get("QwsvSPpnRul") ?? []);

    const { enrollment, events, mainEvent, ruleResult } =
        useTrackerState("K2nxbE9ubSs");

    const attributes = Array.from(trackedEntityAttributes.values());

    const keys: Map<string, string> = new Map(
        attributes?.map((attr) => [
            attr.id,
            attr.displayFormName || attr.name || "",
        ]),
    );

    const trackedEntity = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    const dataElementToAttributeMap: Record<string, string> = {
        KJ2V2JlOxFi: "Y3DE5CZWySr",
    };

    // Configuration: Attributes to auto-populate from parent tracked entity
    // These attributes will be copied from the current patient to the new patient
    const parentAttributesToCopy: string[] = [
        "XjgpfkoxffK",
        "W87HAtUHJjB",
        "PKuyTiVCR89",
        "oTI0DLitzFY",
    ];

    // Configuration: Rename/relabel attributes in the nested modal
    // Use this to change how attribute labels appear (e.g., "First Name" → "Mother's First Name")
    const attributeLabelOverrides: Record<string, string> = {
        // Format: 'attributeId': 'New Label'
        // Example: Change "First Name" to "Mother's First Name"
        // 'firstNameAttributeId': "Mother's First Name",
        // 'lastNameAttributeId': "Mother's Last Name",
        // 'dateOfBirthAttributeId': "Mother's Date of Birth",
    };

    // Configuration: Populate fields with combined values from multiple sources
    // Just pre-fills the target field - does NOT hide or rename anything
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

    const [visitForm] = Form.useForm();
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState(0);
    const [isNestedModalOpen, setIsNestedModalOpen] = useState(false);
    const [nestedModalKey, setNestedModalKey] = useState(0);
    const [nestedForm] = Form.useForm();
    // const [isUpdatingFromRules, setIsUpdatingFromRules] = useState(false);
    // const { clearDraft } = useAutoSave({
    //     form: visitForm,
    //     draftId: mainEvent.event,
    //     type: "event",
    //     interval: 30000,
    //     enabled: isVisitModalOpen,
    //     metadata: {
    //         trackedEntity: enrollment.trackedEntity,
    //         programStage: "K2nxbE9ubSs",
    //         enrollment: enrollment.enrollment,
    //         orgUnit: enrollment.orgUnit,
    //         program: enrollment.program,
    //         isNew: !mainEvent.event || mainEvent.event.startsWith("temp"),
    //     },
    //     onSave: () => console.log("💾 Visit draft auto-saved"),
    // });
    const onVisitSubmit = (values: Record<string, any>) => {
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
            const event: ReturnType<
                typeof flattenTrackedEntity
            >["events"][number] = {
                ...mainEvent,
                occurredAt,
                dataValues: { ...mainEvent.dataValues, ...finalValues },
            };
            trackerActor.send({
                type: "CREATE_OR_UPDATE_EVENT",
                event,
            });
            trackerActor.send({ type: "SAVE_EVENTS" });

            message.success({
                content: "Visit record saved successfully!",
                duration: 3,
            });
            // Clear draft after successful submission
            // clearDraft();
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
        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: visit });
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(true);
    };

    const showCreateVisitModal = () => {
        // Reset form and machine state before creating new visit
        visitForm.resetFields();
        trackerActor.send({ type: "RESET_MAIN_EVENT" });

        const emptyEvent = createEmptyEvent({
            program: enrollment.program,
            trackedEntity: enrollment.trackedEntity,
            enrollment: enrollment.enrollment,
            orgUnit: enrollment.orgUnit,
            programStage: "K2nxbE9ubSs",
        });

        trackerActor.send({ type: "SET_MAIN_EVENT", mainEvent: emptyEvent });
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(true);
    };

    const handleModalClose = () => {
        visitForm.resetFields();
        trackerActor.send({ type: "RESET_MAIN_EVENT" });
        setIsVisitModalOpen(false);
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

        // Auto-populate attributes from parent tracked entity
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

        // Get current form values from visit form
        const currentFormValues = visitForm.getFieldsValue();
        console.log("Current form values for nested modal:", currentFormValues);

        // Map data elements to attributes
        const mappedAttributes: Record<string, any> = {};
        Object.entries(dataElementToAttributeMap).forEach(
            ([dataElementId, attributeId]) => {
                if (currentFormValues[dataElementId]) {
                    let value = currentFormValues[dataElementId];

                    // Convert dayjs objects to string format for date fields
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
            const newTrackedEntity: ReturnType<typeof flattenTrackedEntity> = {
                ...createEmptyTrackedEntity({
                    orgUnit: enrollment.orgUnit,
                }),
                attributes: values,
            };

            trackerActor.send({
                type: "CREATE_TRACKED_CHILD_ENTITY",
                trackedEntity: newTrackedEntity,
            });
            closeNestedModal();
        } catch (error) {
            console.error("Error creating patient:", error);
            message.error({
                content: "Failed to register patient. Please try again.",
                duration: 5,
            });
        }
    };

    const handleNestedFormSubmit = async () => {
        try {
            await nestedForm.validateFields();
            nestedForm.submit();
        } catch (error) {
            console.error("Nested form validation failed:", error);
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
            // {
            //     title: "Services",
            //     dataIndex: ["dataValues", "mrKZWf2WMIC"],
            //     key: "services",
            //     render: (text) => (
            //         <Flex gap="small" align="center" wrap>
            //             {text.split(",").map((tag) => {
            //                 return (
            //                     <Tag key={tag} color="blue">
            //                         {tag.toUpperCase()}
            //                     </Tag>
            //                 );
            //             })}
            //         </Flex>
            //     ),
            // },
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
        [], // Empty deps - columns don't depend on state
    );
    const items: DescriptionsProps["items"] = Object.entries(
        trackedEntity.attributes || {},
    ).map(([key, value]) => ({
        key: key,
        label: keys.get(key) || key,
        children: <Text>{String(value)}</Text>,
    }));

    const handleValuesChange = (_changed: any, allValues: any) => {
        if (_changed && _changed["REWqohCg4Km"] === "Yes") {
            openNestedModal();
        }
        trackerActor.send({
            type: "EXECUTE_PROGRAM_RULES",
            dataValues: allValues,
            programRules,
            programRuleVariables,
            programStage: mainEvent.programStage,
            attributeValues: trackedEntity.attributes,
        });
        trackerActor.send({
            type: "UPDATE_DATA_WITH_ASSIGNMENTS",
        });
    };

    useEffect(() => {
        if (isVisitModalOpen) {
            trackerActor.send({
                type: "EXECUTE_PROGRAM_RULES",
                programRules: programRules,
                programRuleVariables: programRuleVariables,
                programStage: mainEvent.programStage,
                dataValues: mainEvent.dataValues,
                attributeValues: trackedEntity.attributes,
            });
            trackerActor.send({
                type: "UPDATE_DATA_WITH_ASSIGNMENTS",
            });
        }
    }, [isVisitModalOpen]);

    // Initialize form with event data values when modal opens
    // useEffect(() => {
    //     if (isVisitModalOpen && mainEvent) {
    //         visitForm.resetFields();
    //         visitForm.setFieldsValue();
    //     }
    // }, [isVisitModalOpen, mainEvent.event, visitForm]);

    // Apply program rule assignments to form fields automatically
    useEffect(() => {
        if (
            isVisitModalOpen &&
            Object.keys(ruleResult.assignments).length > 0
        ) {
            visitForm.setFieldsValue(ruleResult.assignments);
        }
        if (isVisitModalOpen && ruleResult.hiddenOptions["QwsvSPpnRul"]) {
            setServiceTypes((prev) =>
                prev.flatMap((o) => {
                    if (ruleResult.hiddenOptions["QwsvSPpnRul"].has(o.id)) {
                        return [];
                    }
                    return o;
                }),
            );
        }
    }, [ruleResult, isVisitModalOpen, visitForm]);

    // Listen for state machine transitions and show appropriate messages
    // useEffect(() => {
    //     if (machineState === "entitySuccess") {
    //         message.success({
    //             content: "Patient registered successfully!",
    //             duration: 3,
    //         });
    //     } else if (machineState === "failure") {
    //         message.error({
    //             content: "Failed to save patient. Please try again.",
    //             duration: 5,
    //         });
    //     }
    // }, [machineState]);

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
                                >
                                    Add Visit
                                </Button>
                            }
                            // styles={{ body: { padding: 0, margin: 0 } }}
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
                            {mainEvent.event &&
                            !mainEvent.event.startsWith("temp")
                                ? "Edit Visit Record"
                                : "New Visit Record"}
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
                                    {mainEvent.occurredAt
                                        ? dayjs(mainEvent.occurredAt).format(
                                              "MMM DD, YYYY",
                                          )
                                        : "Not set"}
                                </Text>
                            </Text>
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
                                Save Visit
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
            >
                <Form
                    form={visitForm}
                    layout="vertical"
                    onFinish={onVisitSubmit}
                    onValuesChange={handleValuesChange}
                    style={{ margin: 0, padding: 0 }}
                    initialValues={{
                        ...mainEvent.dataValues,
                        occurredAt: mainEvent.occurredAt,
                    }}
                >
                    <Flex vertical gap={10} style={{ width: "100%" }}>
                        {/* Visit Basic Info Card */}
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
                                        />
                                    </Form.Item>
                                </Col>
                            </Row>
                        </Card>

                        {/* Visit Details Tabs */}
                        <Tabs
                            tabPlacement="start"
                            items={program.programStages.flatMap((stage) => {
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
                                                vertical: psde.renderType
                                                    ? psde.renderType.DESKTOP
                                                          ?.type !==
                                                      "HORIZONTAL_RADIOBUTTONS"
                                                    : false,
                                            },
                                        ],
                                    ),
                                );
                                if (
                                    [
                                        "opwSN351xGC",
                                        "zKGWob5AZKP",
                                        "DA0Yt3V16AN",
                                    ].indexOf(stage.id) !== -1
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
                                return stage.programStageSections.flatMap(
                                    (section) => {
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
                                                                (
                                                                    dataElement,
                                                                ) => {
                                                                    const currentDataElement =
                                                                        dataElements.get(
                                                                            dataElement.id,
                                                                        );
                                                                    const {
                                                                        compulsory = false,
                                                                        vertical = false,
                                                                        renderOptionsAsRadio = false,
                                                                    } = currentDataElements.get(
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
                                                                            ) ??
                                                                            [];
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
                                                                            (
                                                                                msg,
                                                                            ) =>
                                                                                msg.key ===
                                                                                dataElement.id,
                                                                        );
                                                                    const messages =
                                                                        ruleResult.messages.filter(
                                                                            (
                                                                                msg,
                                                                            ) =>
                                                                                msg.key ===
                                                                                dataElement.id,
                                                                        );
                                                                    const warnings =
                                                                        ruleResult.warnings.filter(
                                                                            (
                                                                                msg,
                                                                            ) =>
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
                                                                            renderOptionsAsRadio={
                                                                                renderOptionsAsRadio
                                                                            }
                                                                            vertical={
                                                                                vertical
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
                                                                            key={
                                                                                dataElement.id
                                                                            }
                                                                            form={
                                                                                visitForm
                                                                            }
                                                                        />
                                                                    );
                                                                },
                                                            )}
                                                        </Row>
                                                    </Card>
                                                ),
                                            },
                                        ];
                                    },
                                );
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
                            Patient Registration
                        </Text>
                    </Flex>
                }
                width="85vw"
                footer={
                    <Flex
                        justify="end"
                        gap="middle"
                        style={{ padding: "8px 0" }}
                    >
                        <Button
                            onClick={closeNestedModal}
                            style={{ borderRadius: 8 }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            onClick={handleNestedFormSubmit}
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
                            Register Patient
                        </Button>
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
                                                trackedEntityAttributes.get(
                                                    id,
                                                )!;
                                            const optionSet =
                                                current.optionSet?.id ?? "";
                                            const finalOptions =
                                                optionSets.get(optionSet);
                                            const allAttributes: Map<
                                                string,
                                                boolean
                                            > = new Map(
                                                program.programTrackedEntityAttributes.map(
                                                    ({
                                                        mandatory,
                                                        trackedEntityAttribute:
                                                            { id },
                                                    }) => [id, mandatory],
                                                ),
                                            );

                                            return (
                                                <DataElementField
                                                    key={id}
                                                    dataElement={current}
                                                    hidden={false}
                                                    renderOptionsAsRadio={false}
                                                    vertical={false}
                                                    finalOptions={finalOptions}
                                                    messages={[]}
                                                    warnings={[]}
                                                    errors={[]}
                                                    required={
                                                        allAttributes.get(id) ||
                                                        false
                                                    }
                                                    span={6}
                                                    form={nestedForm}
                                                    customLabel={
                                                        attributeLabelOverrides[
                                                            id
                                                        ]
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
