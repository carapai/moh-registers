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
import { db, FlattenedTrackedEntity, Village } from "../db";
import { createSyncManager } from "../db/sync";
import { TrackerContext } from "../machines/tracker";
import { resourcesQueryOptions } from "../query-options";
import {
    DataElement,
    OrgUnit,
    Program,
    ProgramRule,
    ProgramRuleVariable,
    RelationshipType,
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
        const prevRelationshipTypes = await db.relationshipTypes.count();

        if (
            prevDataElements === 0 ||
            prevAttributes === 0 ||
            prevProgramRules === 0 ||
            prevProgramRuleVariables === 0 ||
            prevOptionGroups === 0 ||
            prevOptionSets === 0 ||
            prevPrograms === 0 ||
            prevVillages === 0 ||
            prevRelationshipTypes === 0
        ) {
            const [
                villages,
                program,
                { optionSets },
                { dataElements },
                { trackedEntityAttributes },
                { programRules },
                { programRuleVariables },
                { optionGroups },
                relationshipType,
            ] = (await queryClient.ensureQueryData(
                resourcesQueryOptions({
                    engine,
                    queries: {
                        villages: {
                            resource: "dataStore/registers",
                            id: "villages",
                        },
                        program: {
                            resource: "programs",
                            id: "ueBhWkWll5v",
                            params: {
                                fields: "id,name,programSections[id,name,sortOrder,trackedEntityAttributes[id]],trackedEntityType[id,trackedEntityTypeAttributes[id]],programType,selectEnrollmentDatesInFuture,selectIncidentDatesInFuture,organisationUnits,programStages[id,repeatable,name,code,programStageDataElements[id,compulsory,renderOptionsAsRadio,dataElement[id],renderType,allowFutureDate],programStageSections[id,name,sortOrder,dataElements[id]]],programTrackedEntityAttributes[id,mandatory,searchable,renderOptionsAsRadio,renderType,sortOrder,allowFutureDate,displayInList,trackedEntityAttribute[id]]",
                            },
                        },
                        optionSets: {
                            resource: "optionSets",
                            params: {
                                fields: "id,options[id,name,code]",
                                paging: false,
                            },
                        },
                        dataElements: {
                            resource: "dataElements",
                            params: {
                                fields: "id,name,code,valueType,formName,optionSetValue,optionSet[id]",
                                paging: false,
                            },
                        },
                        trackedEntityAttributes: {
                            resource: "trackedEntityAttributes",
                            params: {
                                fields: "id,name,code,unique,generated,pattern,confidential,valueType,optionSetValue,displayFormName,formName,optionSet[id]",
                                paging: false,
                            },
                        },
                        programRules: {
                            resource: `programRules.json`,
                            params: {
                                filter: "program.id:eq:ueBhWkWll5v",
                                fields: "*,programRuleActions[*]",
                                paging: false,
                            },
                        },
                        programRuleVariables: {
                            resource: `programRuleVariables.json`,
                            params: {
                                filter: "program.id:eq:ueBhWkWll5v",
                                fields: "*",
                                paging: false,
                            },
                        },
                        optionGroups: {
                            resource: "optionGroups",
                            params: {
                                fields: "id,options[id,name,code]",
                                paging: false,
                            },
                        },
                        motherChildRelationship: {
                            resource: "relationshipTypes",
                            id: "vDnDNhGRzzy",
                        },
                    },
                }),
            )) as [
                Village[],
                Program,
                {
                    optionSets: {
                        id: string;
                        options: { id: string; name: string; code: string }[];
                    }[];
                },
                { dataElements: DataElement[] },
                {
                    trackedEntityAttributes: TrackedEntityAttribute[];
                },
                { programRules: ProgramRule[] },
                {
                    programRuleVariables: ProgramRuleVariable[];
                },
                {
                    optionGroups: Array<{
                        id: string;
                        options: {
                            id: string;
                            name: string;
                            code: string;
                        }[];
                    }>;
                },
                RelationshipType,
            ];

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
            await db.programs.put(program);
            await db.dataElements.bulkPut(dataElements);
            await db.trackedEntityAttributes.bulkPut(trackedEntityAttributes);
            await db.programRules.bulkPut(programRules);
            await db.programRuleVariables.bulkPut(programRuleVariables);
            await db.optionGroups.bulkPut(finalOptionGroups);
            await db.optionSets.bulkPut(finalOptionSets);
            await db.villages.bulkPut(villages);
            await db.relationshipTypes.put(relationshipType);
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
                programOrgUnits: new Set(
                    program.organisationUnits.map(({ id }) => id),
                ),
                program,
                villages,
                motherChildRelation: relationshipType,
            };
        }

        const dataElements = await db.dataElements.toArray();
        const trackedEntityAttributes =
            await db.trackedEntityAttributes.toArray();
        const programRules = await db.programRules.toArray();
        const programRuleVariables = await db.programRuleVariables.toArray();
        const optionGroups = await db.optionGroups.toArray();
        const optionSets = await db.optionSets.toArray();
        const [program] = await db.programs.toArray();
        const villages = await db.villages.toArray();
        const [motherChildRelation] = await db.relationshipTypes.toArray();

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
            program,
            villages,
            programOrgUnits: new Set(
                program.organisationUnits.map(({ id }) => id),
            ),
						motherChildRelation
        };
    },
});

function LayoutWithDrafts({
    orgUnit,
    draftModalVisible,
    setDraftModalVisible,
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
    const handleDraftRecover = (
        draft:
            | FlattenedTrackedEntity
            | FlattenedTrackedEntity["events"][number],
        type: "event" | "trackedEntity",
    ) => {
        try {
            if (type === "event") {
                const mainEvent =
                    draft as FlattenedTrackedEntity["events"][number];
                trackerActor.send({
                    type: "SET_MAIN_EVENT",
                    mainEvent,
                });
                navigate({
                    to: "/tracked-entity/$trackedEntity",
                    params: { trackedEntity: mainEvent.trackedEntity },
                });
                message.success(
                    "Draft loaded successfully. You can continue editing.",
                );
            } else {
                const trackedEntity = draft as FlattenedTrackedEntity;
                trackerActor.send({
                    type: "SET_TRACKED_ENTITY",
                    trackedEntity,
                });
                message.success(
                    "Registration draft loaded. You can continue editing.",
                );
            }

            setDraftModalVisible(false);
        } catch (error) {
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
                            <Text style={{ fontWeight: 300 }}>eRegistry</Text>
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
                                    console.log(
                                        "Drafts button clicked, opening modal",
                                    );
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
