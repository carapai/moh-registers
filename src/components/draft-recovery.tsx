import React, { useEffect, useState } from "react";
import {
    Modal,
    List,
    Button,
    Tag,
    Typography,
    Space,
    Empty,
    Popconfirm,
    Tooltip,
} from "antd";
import {
    ClockCircleOutlined,
    DeleteOutlined,
    EditOutlined,
    FileTextOutlined,
} from "@ant-design/icons";
import {
    getAllEventDrafts,
    getAllTrackedEntityDrafts,
    deleteEventDraft,
    deleteTrackedEntityDraft,
} from "../db/operations";
import type { EventDraft, TrackedEntityDraft } from "../db";

const { Text } = Typography;

/**
 * Draft Recovery Component
 *
 * Displays saved drafts and allows users to recover or delete them.
 * Shows both event drafts (visits) and tracked entity drafts (registrations).
 */

interface DraftRecoveryProps {
    /** Whether the modal is visible */
    visible: boolean;

    /** Callback when modal is closed */
    onClose: () => void;

    /** Callback when a draft is selected for recovery */
    onRecover?: (draft: EventDraft | TrackedEntityDraft, type: "event" | "trackedEntity") => void;
}

type DraftItem = {
    id: string;
    type: "event" | "trackedEntity";
    data: EventDraft | TrackedEntityDraft;
    updatedAt: string;
    label: string;
};

export const DraftRecovery: React.FC<DraftRecoveryProps> = ({
    visible,
    onClose,
    onRecover,
}) => {
    const [drafts, setDrafts] = useState<DraftItem[]>([]);
    const [loading, setLoading] = useState(false);

    /**
     * Load all drafts from IndexedDB
     */
    const loadDrafts = async () => {
        console.log("📥 Starting to load drafts...");
        setLoading(true);
        try {
            // ✅ FIX: Functions now return { drafts, total } instead of arrays
            const [eventDraftsResult, trackedEntityDraftsResult] = await Promise.all([
                getAllEventDrafts(),
                getAllTrackedEntityDrafts(),
            ]);

            console.log("📊 Event drafts:", eventDraftsResult.drafts.length);
            console.log("📊 Tracked entity drafts:", trackedEntityDraftsResult.drafts.length);

            const allDrafts: DraftItem[] = [
                ...eventDraftsResult.drafts.map((draft) => ({
                    id: draft.id,
                    type: "event" as const,
                    data: draft,
                    updatedAt: draft.updatedAt,
                    label: draft.isNew ? "New Visit" : "Edit Visit",
                })),
                ...trackedEntityDraftsResult.drafts.map((draft) => ({
                    id: draft.id,
                    type: "trackedEntity" as const,
                    data: draft,
                    updatedAt: draft.updatedAt,
                    label: draft.isNew ? "New Registration" : "Edit Registration",
                })),
            ];

            // Sort by most recent first
            allDrafts.sort(
                (a, b) =>
                    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            );

            console.log("✅ Total drafts loaded:", allDrafts.length);
            setDrafts(allDrafts);
        } catch (error) {
            console.error("❌ Failed to load drafts:", error);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Delete a draft
     */
    const handleDelete = async (draft: DraftItem) => {
        try {
            if (draft.type === "event") {
                await deleteEventDraft(draft.id);
            } else {
                await deleteTrackedEntityDraft(draft.id);
            }

            // Reload drafts
            await loadDrafts();
        } catch (error) {
            console.error("❌ Failed to delete draft:", error);
        }
    };

    /**
     * Recover a draft
     */
    const handleRecover = (draft: DraftItem) => {
        if (onRecover) {
            onRecover(draft.data, draft.type);
        }
        onClose();
    };

    /**
     * Load drafts when modal opens
     */
    useEffect(() => {
        console.log("DraftRecovery modal visible state changed:", visible);
        if (visible) {
            console.log("Loading drafts...");
            loadDrafts();
        }
    }, [visible]);

    /**
     * Render draft type tag
     */
    const renderTypeTag = (type: "event" | "trackedEntity") => {
        if (type === "event") {
            return <Tag color="blue">Visit</Tag>;
        }
        return <Tag color="green">Registration</Tag>;
    };

    /**
     * Render time ago
     */
    const renderTimeAgo = (updatedAt: string) => {
        const now = new Date();
        const updated = new Date(updatedAt);
        const diffMs = now.getTime() - updated.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return "Just now";
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
        } else {
            return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
        }
    };

    return (
        <Modal
            title={
                <Space>
                    <FileTextOutlined />
                    <span>Recover Drafts</span>
                </Space>
            }
            open={visible}
            onCancel={onClose}
            footer={[
                <Button key="close" onClick={onClose}>
                    Close
                </Button>,
            ]}
            width={600}
            data-testid="draft-recovery-modal"
            style={{ zIndex: 9999 }}
        >
            {drafts.length === 0 ? (
                <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No saved drafts found"
                    style={{ padding: "40px 0" }}
                />
            ) : (
                <List
                    loading={loading}
                    dataSource={drafts}
                    renderItem={(draft) => (
                        <List.Item
                            key={draft.id}
                            actions={[
                                <Tooltip title="Recover draft">
                                    <Button
                                        type="link"
                                        icon={<EditOutlined />}
                                        onClick={() => handleRecover(draft)}
                                    >
                                        Recover
                                    </Button>
                                </Tooltip>,
                                <Popconfirm
                                    title="Delete draft"
                                    description="Are you sure you want to delete this draft?"
                                    onConfirm={() => handleDelete(draft)}
                                    okText="Yes"
                                    cancelText="No"
                                >
                                    <Tooltip title="Delete draft">
                                        <Button
                                            type="link"
                                            danger
                                            icon={<DeleteOutlined />}
                                        >
                                            Delete
                                        </Button>
                                    </Tooltip>
                                </Popconfirm>,
                            ]}
                        >
                            <List.Item.Meta
                                title={
                                    <Space>
                                        {renderTypeTag(draft.type)}
                                        <Text strong>{draft.label}</Text>
                                    </Space>
                                }
                                description={
                                    <Space
                                        direction="vertical"
                                        size="small"
                                        style={{ width: "100%" }}
                                    >
                                        <Space>
                                            <ClockCircleOutlined
                                                style={{ color: "#8c8c8c" }}
                                            />
                                            <Text type="secondary">
                                                {renderTimeAgo(draft.updatedAt)}
                                            </Text>
                                        </Space>
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            ID: {draft.id.substring(0, 8)}...
                                        </Text>
                                    </Space>
                                }
                            />
                        </List.Item>
                    )}
                />
            )}
        </Modal>
    );
};
