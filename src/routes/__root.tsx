import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";

import {
    FileTextOutlined,
    HomeOutlined,
    MoreOutlined,
} from "@ant-design/icons";
import { Button, Layout, Space, Tooltip, Typography } from "antd";

const { Header } = Layout;
const { Title, Text } = Typography;

import { Flex } from "antd";
import useApp from "antd/es/app/useApp";
import { groupBy } from "lodash";
import { DraftRecovery } from "../components/draft-recovery";
import { SyncErrorBoundary } from "../components/sync-error-boundary";
import { SyncStatus } from "../components/sync-status";
import { db, type EventDraft, type TrackedEntityDraft } from "../db";
import { createSyncManager } from "../db/sync";
import { TrackerContext } from "../machines/tracker";
import { resourceQueryOptions } from "../query-options";
import {
    DataElement,
    OrgUnit,
    Program,
    ProgramRule,
    ProgramRuleVariable,
    TrackedEntityAttribute,
} from "../schemas";

export const RootRoute = createRootRouteWithContext<{
    queryClient: QueryClient;
    engine: ReturnType<typeof useDataEngine>;
    orgUnit: OrgUnit;
}>()({
    component: RootRouteComponent,
    loader: async ({ context: { queryClient, engine } }) => {
        const prevDataElements = await db.dataElements.count();
        const prevAttributes = await db.trackedEntityAttributes.count();
        const prevProgramRules = await db.programRules.count();
        const prevProgramRuleVariables = await db.programRuleVariables.count();
        const prevOptionGroups = await db.optionGroups.count();
        const prevOptionSets = await db.optionSets.count();
        const prevPrograms = await db.programs.count();
        const prevVillages = await db.villages.count();

        if (
            prevDataElements === 0 ||
            prevAttributes === 0 ||
            prevProgramRules === 0 ||
            prevProgramRuleVariables === 0 ||
            prevOptionGroups === 0 ||
            prevOptionSets === 0 ||
            prevPrograms === 0 ||
            prevVillages === 0
        ) {
            const villages = await queryClient.ensureQueryData(
                resourceQueryOptions<any>({
                    engine,
                    resource: "dataStore/registers",
                    id: "villages",
                }),
            );
            const program = await queryClient.ensureQueryData(
                resourceQueryOptions<Program>({
                    engine,
                    resource: "programs",
                    id: "ueBhWkWll5v",
                    params: {
                        fields: "id,name,programSections[id,name,sortOrder,trackedEntityAttributes[id]],trackedEntityType[id,trackedEntityTypeAttributes[id]],programType,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,organisationUnits,programStages[id,repeatable,name,code,programStageDataElements[id,compulsory,dataElement[id],renderType,allowFutureDate],programStageSections[id,name,sortOrder,dataElements[id]]],programTrackedEntityAttributes[id,mandatory,sortOrder,allowFutureDate,displayInList,trackedEntityAttribute[id]]",
                    },
                }),
            );
            const { optionSets } = await queryClient.ensureQueryData(
                resourceQueryOptions<{
                    optionSets: {
                        id: string;
                        options: { id: string; name: string; code: string }[];
                    }[];
                }>({
                    engine,
                    resource: "optionSets",
                    params: {
                        fields: "id,options[id,name,code]",
                        paging: false,
                    },
                }),
            );
            const { dataElements } = await queryClient.ensureQueryData(
                resourceQueryOptions<{ dataElements: DataElement[] }>({
                    engine,
                    resource: "dataElements",
                    params: {
                        fields: "id,name,code,valueType,formName,optionSetValue,optionSet[id]",
                        paging: false,
                    },
                }),
            );

            const { trackedEntityAttributes } =
                await queryClient.ensureQueryData(
                    resourceQueryOptions<{
                        trackedEntityAttributes: TrackedEntityAttribute[];
                    }>({
                        engine,
                        resource: "trackedEntityAttributes",
                        params: {
                            fields: "id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,formName,optionSet[id]",
                            paging: false,
                        },
                    }),
                );
            const { programRules } = await queryClient.ensureQueryData(
                resourceQueryOptions<{ programRules: ProgramRule[] }>({
                    engine,
                    resource: `programRules.json`,
                    params: {
                        filter: "program.id:eq:ueBhWkWll5v",
                        fields: "*,programRuleActions[*]",
                        paging: false,
                    },
                }),
            );
            const { programRuleVariables } = await queryClient.ensureQueryData(
                resourceQueryOptions<{
                    programRuleVariables: ProgramRuleVariable[];
                }>({
                    engine,
                    resource: `programRuleVariables.json`,
                    params: {
                        filter: "program.id:eq:ueBhWkWll5v",
                        fields: "*",
                        paging: false,
                    },
                }),
            );
            const { optionGroups } = await queryClient.ensureQueryData(
                resourceQueryOptions<{
                    optionGroups: Array<{
                        id: string;
                        options: {
                            id: string;
                            name: string;
                            code: string;
                        }[];
                    }>;
                }>({
                    engine,
                    resource: "optionGroups",
                    params: {
                        fields: "id,options[id,name,code]",
                        paging: false,
                    },
                }),
            );

            const finalOptionGroups = optionGroups.flatMap((og) =>
                og.options.map((o) => ({
                    ...o,
                    optionGroup: og.id,
                })),
            );
            const finalOptionSets = optionSets.flatMap((os) =>
                os.options.map((o) => ({
                    ...o,
                    optionSet: os.id,
                })),
            );
            await db.programs.bulkPut([program]);
            await db.dataElements.bulkPut(dataElements);
            await db.trackedEntityAttributes.bulkPut(trackedEntityAttributes);
            await db.programRules.bulkPut(programRules);
            await db.programRuleVariables.bulkPut(programRuleVariables);
            await db.optionGroups.bulkPut(finalOptionGroups);
            await db.optionSets.bulkPut(finalOptionSets);
            await db.villages.bulkPut(villages);
            return {
                dataElements: new Map(dataElements.map((de) => [de.id, de])),
                trackedEntityAttributes: new Map(
                    trackedEntityAttributes.map((ta) => [ta.id, ta]),
                ),
                programRules: programRules,
                programRuleVariables: programRuleVariables,
                optionGroups: new Map(
                    Object.entries(
                        groupBy(finalOptionGroups, "optionGroup"),
                    ).map(([id, og]) => [id, og]),
                ),
                optionSets: new Map(
                    Object.entries(groupBy(finalOptionSets, "optionSet")).map(
                        ([id, os]) => [id, os],
                    ),
                ),
                program,
                villages,
            };
        }

        const dataElements = await db.dataElements.toArray();
        const trackedEntityAttributes =
            await db.trackedEntityAttributes.toArray();
        const programRules = await db.programRules.toArray();
        const programRuleVariables = await db.programRuleVariables.toArray();
        const optionGroups = await db.optionGroups.toArray();
        const optionSets = await db.optionSets.toArray();
        const programs = await db.programs.toArray();
        const villages = await db.villages.toArray();

        return {
            dataElements: new Map(dataElements.map((de) => [de.id, de])),
            trackedEntityAttributes: new Map(
                trackedEntityAttributes.map((ta) => [ta.id, ta]),
            ),
            programRules,
            programRuleVariables,
            optionGroups: new Map(
                Object.entries(groupBy(optionGroups, "optionGroup")).map(
                    ([id, og]) => [id, og],
                ),
            ),
            optionSets: new Map(
                Object.entries(groupBy(optionSets, "optionSet")).map(
                    ([id, os]) => [id, os],
                ),
            ),
            program: programs[0],
            villages,
        };
    },
});

function LayoutWithDrafts({
    orgUnit,
    draftModalVisible,
    setDraftModalVisible
}: {
    orgUnit: OrgUnit;
    draftModalVisible: boolean;
    setDraftModalVisible: (visible: boolean) => void;
}) {
    const { message } = useApp();
    const navigate = RootRoute.useNavigate();
    const trackerActor = TrackerContext.useActorRef();

    /**
     * Handle draft recovery
     * Loads draft data into state machine and navigates to appropriate route
     */
    const handleDraftRecover = (draft: EventDraft | TrackedEntityDraft, type: "event" | "trackedEntity") => {
        try {
            if (type === "event") {
                const eventDraft = draft as EventDraft;

                // Load draft into state machine
                trackerActor.send({
                    type: "SET_MAIN_EVENT",
                    mainEvent: {
                        event: eventDraft.event,
                        programStage: eventDraft.programStage,
                        trackedEntity: eventDraft.trackedEntity,
                        enrollment: eventDraft.enrollment,
                        dataValues: eventDraft.dataValues,
                        occurredAt: eventDraft.occurredAt,
                        orgUnit: eventDraft.orgUnit,
                        program: eventDraft.program,
                        status: "ACTIVE",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                });

                // Navigate to tracked entity page
                navigate({
                    to: "/tracked-entity/$trackedEntity",
                    params: { trackedEntity: eventDraft.trackedEntity },
                });

                message.success("Draft loaded successfully. You can continue editing.");
            } else {
                const trackedEntityDraft = draft as TrackedEntityDraft;

                // Load draft into state machine
                trackerActor.send({
                    type: "SET_TRACKED_ENTITY",
                    trackedEntity: {
                        trackedEntity: trackedEntityDraft.id,
                        attributes: trackedEntityDraft.attributes,
                        enrollment: trackedEntityDraft.enrollment,
                        events: [],
                        orgUnit: trackedEntityDraft.orgUnit,
                        program: trackedEntityDraft.program,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    },
                });

                // Stay on home page or navigate to registration
                message.success("Registration draft loaded. You can continue editing.");
            }

            setDraftModalVisible(false);
        } catch (error) {
            console.error("Failed to recover draft:", error);
            message.error("Failed to load draft. Please try again.");
        }
    };

    return (
        <>
            <Layout
                style={{
                    minHeight: "calc(100vh - 48px)",
                    background: "#f0f2f5",
                }}
            >
                <Header
                    style={{
                        background: "#fff",
                        padding: "0 16px",
                        display: "flex",
                        alignItems: "center",
                        alignContent: "center",
                        justifyItems: "center",
                        justifyContent: "space-between",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                >
                    <Flex align="center" gap="large">
                        <img
                            src="https://upload.wikimedia.org/wikipedia/commons/7/7c/Coat_of_arms_of_Uganda.svg"
                            alt="Uganda Coat of Arms"
                            style={{ height: 54 }}
                        />
                        <Title
                            level={3}
                            style={{ margin: 0, color: "#1f4788" }}
                        >
                            Medical{" "}
                            <Text style={{ fontWeight: 300 }}>
                                eRegistry
                            </Text>
                        </Title>
                    </Flex>

                    <Space>
                        <HomeOutlined
                            style={{ fontSize: 20, color: "#1890ff" }}
                        />
                        <Text strong>{orgUnit.name}</Text>
                        <Button type="text" icon={<MoreOutlined />} />
                        <Tooltip title="Recover saved drafts">
                            <Button
                                icon={<FileTextOutlined />}
                                onClick={() => {
                                    console.log("Drafts button clicked, opening modal");
                                    setDraftModalVisible(true);
                                }}
                            >
                                Drafts
                            </Button>
                        </Tooltip>
                        <SyncStatus />
                    </Space>
                </Header>

                <Outlet />
            </Layout>

            <DraftRecovery
                visible={draftModalVisible}
                onClose={() => setDraftModalVisible(false)}
                onRecover={handleDraftRecover}
            />
        </>
    );
}

function RootRouteComponent() {
    const { engine, orgUnit } = RootRoute.useRouteContext();
    const { message } = useApp();
    const navigate = RootRoute.useNavigate();
    const syncManager = useMemo(() => {
        const manager = createSyncManager(engine);
        manager.startAutoSync(3000);
        return manager;
    }, [engine]);

    const [draftModalVisible, setDraftModalVisible] = useState(false);

    return (
        <SyncErrorBoundary
            onReset={() => {
                console.log("🔄 Error boundary reset");
                // Optionally restart sync manager
                syncManager.startAutoSync(30000);
            }}
        >
            <TrackerContext.Provider
                options={{
                    input: {
                        engine,
                        navigate,
                        orgUnit,
                        syncManager,
                        message,
                    },
                }}
            >
                <LayoutWithDrafts
                    orgUnit={orgUnit}
                    draftModalVisible={draftModalVisible}
                    setDraftModalVisible={setDraftModalVisible}
                />
            </TrackerContext.Provider>
        </SyncErrorBoundary>
    );
}
