import { DatabaseOutlined, FileTextOutlined } from "@ant-design/icons";
import { Button, Divider, Layout, Space, Tooltip, Typography, message } from "antd";
import React, { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { DraftRecovery } from "./draft-recovery";
import { SyncStatus } from "./sync-status";
import { TrackerContext } from "../machines/tracker";
import type { EventDraft, TrackedEntityDraft } from "../db";

const { Header } = Layout;
const { Title } = Typography;

interface AppHeaderProps {
    title?: string;
}

/**
 * Application Header Component
 *
 * Displays application title and sync status indicator
 */
export const AppHeader: React.FC<AppHeaderProps> = ({
    title = "MOH Registers",
}) => {
    const [draftModalVisible, setDraftModalVisible] = useState(false);
    const navigate = useNavigate();
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
            <Header
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 24px",
                    background: "#fff",
                    borderBottom: "1px solid #f0f0f0",
                    height: 48,
                }}
            >
                <Space size="middle">
                    <DatabaseOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                    <Title
                        level={4}
                        style={{ margin: 0, fontWeight: 600, color: "#262626" }}
                    >
                        {title}
                    </Title>
                </Space>

                <Space size="large" separator={<Divider orientation="vertical" />}>
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

            <DraftRecovery
                visible={draftModalVisible}
                onClose={() => setDraftModalVisible(false)}
                onRecover={handleDraftRecover}
            />
        </>
    );
};
