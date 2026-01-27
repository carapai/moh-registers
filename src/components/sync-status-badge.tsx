import {
    CheckCircleOutlined,
    ClockCircleOutlined,
    CloseCircleOutlined,
    SyncOutlined,
} from "@ant-design/icons";
import { Badge, Tooltip } from "antd";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import React from "react";
import type { SyncStatus } from "../db";

dayjs.extend(relativeTime);

/**
 * SyncStatusBadge Component
 *
 * Visual indicator for entity/event sync status.
 * Shows status with appropriate icon and color.
 *
 * Usage:
 * ```typescript
 * <SyncStatusBadge
 *   syncStatus="pending"
 *   lastModified="2024-01-20T10:00:00Z"
 *   lastSynced="2024-01-20T09:55:00Z"
 * />
 * ```
 */

export interface SyncStatusBadgeProps {
    syncStatus?: SyncStatus;
    lastModified?: string;
    lastSynced?: string;
    syncError?: string;
    showText?: boolean;
    size?: "small" | "default";
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
    syncStatus = "draft",
    lastModified,
    lastSynced,
    syncError,
    showText = false,
    size = "default",
}) => {
    const getStatusConfig = () => {
        switch (syncStatus) {
            case "synced":
                return {
                    status: "success" as const,
                    text: "Synced",
                    icon: <CheckCircleOutlined />,
                    color: "#52c41a",
                };
            case "pending":
                return {
                    status: "warning" as const,
                    text: "Pending",
                    icon: <ClockCircleOutlined />,
                    color: "#faad14",
                };
            case "syncing":
                return {
                    status: "processing" as const,
                    text: "Syncing",
                    icon: <SyncOutlined spin />,
                    color: "#1890ff",
                };
            case "failed":
                return {
                    status: "error" as const,
                    text: "Failed",
                    icon: <CloseCircleOutlined />,
                    color: "#ff4d4f",
                };
            case "draft":
            default:
                return {
                    status: "default" as const,
                    text: "Draft",
                    icon: <ClockCircleOutlined />,
                    color: "#d9d9d9",
                };
        }
    };

    const config = getStatusConfig();

    const tooltipContent = (
        <div>
            <div>
                <strong>Status:</strong> {config.text}
            </div>
            {lastModified && (
                <div>
                    <strong>Modified:</strong> {dayjs(lastModified).fromNow()}
                </div>
            )}
            {lastSynced && (
                <div>
                    <strong>Last synced:</strong> {dayjs(lastSynced).fromNow()}
                </div>
            )}
            {syncError && (
                <div style={{ color: "#ff4d4f" }}>
                    <strong>Error:</strong> {syncError}
                </div>
            )}
        </div>
    );

    if (showText) {
        return (
            <Tooltip title={tooltipContent}>
                <Badge
                    status={config.status}
                    text={config.text}
                    style={{ fontSize: size === "small" ? 12 : 14 }}
                />
            </Tooltip>
        );
    }

    return (
        <Tooltip title={tooltipContent}>
            <span
                style={{
                    color: config.color,
                    fontSize: size === "small" ? 14 : 16,
                }}
            >
                {config.icon}
            </span>
        </Tooltip>
    );
};

/**
 * GlobalSyncStatus Component
 *
 * Shows overall sync status for the application.
 * Displays pending count and online/offline indicator.
 *
 * Usage:
 * ```typescript
 * const { status, pendingCount, isOnline } = useSyncStatus(syncManager);
 *
 * <GlobalSyncStatus
 *   status={status}
 *   pendingCount={pendingCount}
 *   isOnline={isOnline}
 * />
 * ```
 */

export interface GlobalSyncStatusProps {
    status: "idle" | "syncing" | "online" | "offline";
    pendingCount: number;
    isOnline: boolean;
    onSyncNow?: () => void;
}

export const GlobalSyncStatus: React.FC<GlobalSyncStatusProps> = ({
    status,
    pendingCount,
    isOnline,
    onSyncNow,
}) => {
    const getStatusConfig = () => {
        if (!isOnline) {
            return {
                color: "orange",
                text: "Offline",
                icon: <CloseCircleOutlined />,
            };
        }

        if (status === "syncing") {
            return {
                color: "blue",
                text: "Syncing...",
                icon: <SyncOutlined spin />,
            };
        }

        if (pendingCount > 0) {
            return {
                color: "gold",
                text: `${pendingCount} pending`,
                icon: <ClockCircleOutlined />,
            };
        }

        return {
            color: "green",
            text: "All synced",
            icon: <CheckCircleOutlined />,
        };
    };

    const config = getStatusConfig();

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "4px 12px",
                background: "#f5f5f5",
                borderRadius: 16,
                fontSize: 12,
            }}
        >
            <span style={{ color: config.color }}>{config.icon}</span>
            <span>{config.text}</span>
            {pendingCount > 0 && isOnline && status !== "syncing" && onSyncNow && (
                <span
                    onClick={onSyncNow}
                    style={{
                        color: "#1890ff",
                        cursor: "pointer",
                        textDecoration: "underline",
                    }}
                >
                    Sync now
                </span>
            )}
        </div>
    );
};
