import {
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    PlusOutlined,
    UserAddOutlined,
} from "@ant-design/icons";
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
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { db } from "../db";
import { useDexieTrackedEntityForm } from "../hooks/useDexieTrackedEntityForm";
import { useEntitySyncStatus } from "../hooks/useEntitySyncStatus";
import { useProgramRulesWithDexie } from "../hooks/useProgramRules";
import { TrackerContext } from "../machines/tracker";
import { RootRoute } from "../routes/__root";
import { RenderType } from "../schemas";
import { DataElementField } from "./data-element-field";
import { calculateColSpan, spans } from "../utils/utils";

const { Text } = Typography;

export const TrackerRegistration: React.FC = () => {
    const {
        program,
        trackedEntityAttributes,
        optionSets,
        programRuleVariables,
        programRules,
        programOrgUnits,
    } = RootRoute.useLoaderData();
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
    const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
    const [modalKey, setModalKey] = useState(0);
    const [form] = Form.useForm();
    const trackedEntityFromState = TrackerContext.useSelector(
        (state) => state.context.trackedEntity,
    );

    const trackerActor = TrackerContext.useActorRef();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const orgUnit = TrackerContext.useSelector(
        (state) => state.context.orgUnit.id,
    );
    const { trackedEntity, updateAttribute, updateAttributes } =
        useDexieTrackedEntityForm({
            trackedEntityId: trackedEntityFromState.trackedEntity || "",
        });
    const { ruleResult, executeAndApplyRules } = useProgramRulesWithDexie({
        form,
        programRules,
        programRuleVariables,
        trackedEntityAttributes:
            trackedEntity?.attributes || trackedEntityFromState.attributes,
        enrollment:
            trackedEntity?.enrollment || trackedEntityFromState.enrollment,
        onAssignments: updateAttributes,
        applyAssignmentsToForm: true,
        persistAssignments: false,
        clearHiddenFields: true,
        program: program.id,
        isRegistration: true,
        debounceMs: 300,
    });

		const { syncStatus, syncError } = useEntitySyncStatus(
        trackedEntity?.trackedEntity || null,
    );

    const fields = useMemo(() => {
        return Object.entries(trackedEntity?.attributes || {}).map(
            ([name, value]) => ({
                name,
                value,
            }),
        );
    }, [trackedEntity?.attributes]);

    const handleTriggerProgramRules = useCallback(() => {
        executeAndApplyRules();
    }, [executeAndApplyRules]);

    const initializedRef = useRef<string | null>(null);

    useEffect(() => {
        const initializeEntity = async () => {
            if (!isVisitModalOpen) {
                initializedRef.current = null;
                return;
            }

            if (!trackedEntityFromState?.trackedEntity) return;
            if (
                initializedRef.current === trackedEntityFromState.trackedEntity
            ) {
                return;
            }

            initializedRef.current = trackedEntityFromState.trackedEntity;
            try {
                await db.trackedEntities.put({
                    ...trackedEntityFromState,
                    syncStatus: "draft",
                    version: 1,
                    lastModified: new Date().toISOString(),
                } as any);
                console.log(
                    "✅ Patient entity initialized as draft in Dexie:",
                    trackedEntityFromState.trackedEntity,
                );
                if (trackedEntityFromState.attributes) {
                    form.setFieldsValue(trackedEntityFromState.attributes);
                    console.log(
                        "📝 Form initialized with tracked entity attributes",
                    );
                }

                if (
                    trackedEntityFromState.attributes &&
                    Object.keys(trackedEntityFromState.attributes).length > 0
                ) {
                    executeAndApplyRules(trackedEntityFromState.attributes);
                } else {
                    console.log(
                        "✨ Creating new patient registration with empty form",
                    );
                }
            } catch (error) {
                console.error("❌ Failed to initialize patient entity:", error);
            }
        };

        initializeEntity();
    }, [
        isVisitModalOpen,
        trackedEntityFromState.trackedEntity,
        executeAndApplyRules,
        form,
    ]);

    const onStageSubmit = async (values: any) => {
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
            setIsSubmitting(true);

            const finalValues = {
                ...values,
                ...ruleResult.assignments,
            };

            await updateAttributes(finalValues);

            if (!trackedEntity?.trackedEntity) {
                throw new Error("Failed to save patient to local database");
            }
            await db.trackedEntities.update(trackedEntity.trackedEntity, {
                syncStatus: "pending",
                lastModified: new Date().toISOString(),
            } as any);

            const saved = await db.trackedEntities.get(
                trackedEntity.trackedEntity,
            );
            if (!saved) {
                throw new Error("Failed to verify patient save");
            }

            console.log(
                "✅ Patient entity marked for sync:",
                trackedEntity.trackedEntity,
            );

            trackerActor.send({
                type: "SET_TRACKED_ENTITY",
                trackedEntity: saved,
            });

            message.success({
                content: "Patient registered successfully!",
                duration: 3,
            });

            setIsVisitModalOpen(false);
            setIsSubmitting(false);

            console.log("✅ Patient entity saved to Dexie with automatic sync");
        } catch (error) {
            console.error("Error creating patient:", error);
            const errorMessage =
                error instanceof Error
                    ? error.message
                    : "Failed to register patient. Please try again.";
            message.error({
                content: errorMessage,
                duration: 5,
            });
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        try {
            await form.validateFields();
            form.submit();
        } catch (error) {
            console.error("Form validation failed:", error);
        }
    };

    const addPatient = () => {
        trackerActor.send({
            type: "RESET_TRACKED_ENTITY",
        });
        form.resetFields();
        setModalKey((prev) => prev + 1);
        setIsVisitModalOpen(() => true);
    };
    return (
        <>
            <Button
                type="primary"
                size="large"
                icon={<PlusOutlined />}
                onClick={addPatient}
                style={{
                    background: "#52c41a",
                    borderColor: "#52c41a",
                    // height: "48px",
                    fontSize: "18px",
                    fontWeight: 500,
                    padding: "0 40px",
                    // borderRadius: "6px",
                    // marginTop: "8px",
                }}
                disabled={!programOrgUnits.has(orgUnit)}
            >
                New patient
            </Button>
            <Modal
                key={modalKey}
                open={isVisitModalOpen}
                onCancel={() => {
                    form.resetFields();
                    setIsVisitModalOpen(false);
                }}
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
                        justify="space-between"
                        align="center"
                        style={{ padding: "8px 0" }}
                    >
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
                        {(!syncStatus || syncStatus === "draft") && <div />}
                        <Flex gap="middle">
                            <Button
                                onClick={() => {
                                    form.resetFields();
                                    setIsVisitModalOpen(false);
                                }}
                                style={{ borderRadius: 8 }}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={isSubmitting}
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
                    </Flex>
                }
                styles={{
                    body: {
                        maxHeight: "75vh",
                        overflow: "auto",
                    },
                    wrapper: {},
                    container: {
                        backgroundColor: "#f5f5f5",
                    },
                }}
            >
                <Form
                    form={form}
                    layout="vertical"
                    fields={fields}
                    onFinish={onStageSubmit}
                    style={{ margin: 0, padding: 0 }}
                    initialValues={trackedEntity?.attributes}
                >
                    <Flex vertical gap={10}>
                        {program.programSections.map(
                            ({ name, trackedEntityAttributes: tei, id }) => {
                                const allAreHidden = tei.every(({ id }) =>
                                    ruleResult.hiddenFields.has(id),
                                );
                                if (allAreHidden) {
                                    return null;
                                }
                                return (
                                    <Card
                                        title={name}
                                        key={id}
                                        style={{
                                            borderRadius: 0,
                                        }}
                                        size="small"
                                    >
                                        <Row gutter={[16, 0]}>
                                            {tei.map(({ id }) => {
                                                if (
                                                    ruleResult.hiddenFields.has(
                                                        id,
                                                    ) &&
                                                    ruleResult
                                                        .shownOptionGroups[
                                                        id
                                                    ] === undefined
                                                ) {
                                                    return [];
                                                }
                                                const current =
                                                    trackedEntityAttributes.get(
                                                        id,
                                                    )!;
                                                if (
                                                    ruleResult.hiddenSections.has(
                                                        id,
                                                    )
                                                )
                                                    return [];

                                                const optionSet =
                                                    current.optionSet?.id ?? "";

                                                const finalOptions = optionSets
                                                    .get(optionSet)
                                                    ?.flatMap((o) => {
                                                        if (
                                                            ruleResult.hiddenOptions[
                                                                o.id
                                                            ]?.has(o.id)
                                                        ) {
                                                            return [];
                                                        }
                                                        return o;
                                                    });

                                                const errors =
                                                    ruleResult.errors.filter(
                                                        (msg) => msg.key === id,
                                                    );
                                                const messages =
                                                    ruleResult.messages.filter(
                                                        (msg) => msg.key === id,
                                                    );
                                                const warnings =
                                                    ruleResult.warnings.filter(
                                                        (msg) => msg.key === id,
                                                    );

                                                const {
                                                    desktopRenderType,
                                                    mandatory,
                                                } = allAttributes.get(id)!;

                                                return (
                                                    <DataElementField
                                                        key={id}
                                                        dataElement={current}
                                                        hidden={false}
                                                        finalOptions={
                                                            finalOptions
                                                        }
                                                        messages={messages}
                                                        warnings={warnings}
                                                        errors={errors}
                                                        required={mandatory}
                                                        disabled={
                                                            id in
                                                            ruleResult.assignments
                                                        }
                                                        span={
                                                            spans.get(id) ||
                                                            calculateColSpan(
                                                                tei.length,
                                                                6,
                                                            )
                                                        }
                                                        form={form}
                                                        desktopRenderType={
                                                            desktopRenderType?.type
                                                        }
                                                        onTriggerProgramRules={
                                                            handleTriggerProgramRules
                                                        }
                                                        onAutoSave={
                                                            updateAttribute
                                                        }
                                                    />
                                                );
                                            })}
                                        </Row>
                                    </Card>
                                );
                            },
                        )}
                    </Flex>
                </Form>
            </Modal>
        </>
    );
};
