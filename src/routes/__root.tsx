import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import React, { useMemo, useState } from "react";

import {
	HomeOutlined,
	MoreOutlined
} from "@ant-design/icons";
import { Button, Layout, Space, Typography } from "antd";
import { createMetadataSync } from "../db/metadata-sync";

const { Header } = Layout;
const { Title, Text } = Typography;

import { Flex } from "antd";
import useApp from "antd/es/app/useApp";
import { groupBy } from "lodash";
import MetadataSyncComponent from "../components/metadata-sync";
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

const queryInfo = async (
    engine: ReturnType<typeof useDataEngine>,
) => {
    // Create metadata sync manager
    const metadataSync = createMetadataSync(engine);

    // Check if we need to sync metadata
    const updateInfo = await metadataSync.checkForUpdates();

    if (updateInfo.hasUpdates) {
        console.log("📡 Syncing metadata...", updateInfo);

        // Perform metadata sync with progress tracking
        await metadataSync.fullSync((progress) => {
            console.log(`📊 Metadata sync progress: ${progress.percentage}% - ${progress.current}`);
        });
    } else {
        console.log("✅ Using cached metadata (last sync:", updateInfo.lastSync, ")");
    }

    // Load metadata from IndexedDB (now always available after sync)
    const dataElements = await db.dataElements.toArray();
    const trackedEntityAttributes = await db.trackedEntityAttributes.toArray();
    const programRules = await db.programRules.toArray();
    const programRuleVariables = await db.programRuleVariables.toArray();
    const optionGroups = await db.optionGroups.toArray();
    const optionSets = await db.optionSets.toArray();
    const [program] = await db.programs.toArray();
    const villages = await db.villages.toArray();
    const [motherChildRelation] = await db.relationshipTypes.toArray();

    // Return formatted metadata
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
            Object.entries(groupBy(optionSets, "optionSet")).map(([id, os]) => [
                id,
                os,
            ]),
        ),
        program,
        villages,
        programOrgUnits: new Set(program.organisationUnits.map(({ id }) => id)),
        motherChildRelation,
    };
};

export const RootRoute = createRootRouteWithContext<{
    queryClient: QueryClient;
    engine: ReturnType<typeof useDataEngine>;
    orgUnit: OrgUnit;
}>()({
    component: RootRouteComponent,
    loader: async ({ context: { engine } }) => {
        try {
            return await queryInfo(engine);
        } catch (error) {
            await db.delete();
            await db.open();
            return await queryInfo(engine);
        }
    },
});

function LayoutWithDrafts({
    orgUnit,
    draftModalVisible,
    setDraftModalVisible,
    metadataSync,
}: {
    orgUnit: OrgUnit;
    draftModalVisible: boolean;
    setDraftModalVisible: (visible: boolean) => void;
    metadataSync: ReturnType<typeof createMetadataSync>;
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
                        {/* <Tooltip title="Recover saved drafts">
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
                        </Tooltip> */}
                        <MetadataSyncComponent metadataSync={metadataSync} />
                        <SyncStatus />
                    </Space>
                </Header>

                <Outlet />
            </Layout>
            {/* <DraftRecovery
                visible={draftModalVisible}
                onClose={() => setDraftModalVisible(false)}
                onRecover={handleDraftRecover}
            /> */}
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

    const metadataSync = useMemo(() => createMetadataSync(engine), [engine]);

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
                    metadataSync={metadataSync}
                />
            </TrackerContext.Provider>
        </SyncErrorBoundary>
    );
}
