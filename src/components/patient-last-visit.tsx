import { useQuery } from "@tanstack/react-query";
import React from "react";
import dayjs from "dayjs";
import { resourceQueryOptions } from "../query-options";
import { TrackedEntitiesRoute } from "../routes/tracked-entities";
import { Spinner } from "./Spinner";
import { EventResponse } from "../schemas";
import { Tag } from "antd";

export const PatientLastVisit: React.FC<{ trackedEntity: string }> = ({
    trackedEntity,
}) => {
    const { engine } = TrackedEntitiesRoute.useRouteContext();
    const { data, isLoading, isError } = useQuery(
        resourceQueryOptions<EventResponse>({
            engine,
            resource: "tracker/events",
            params: {
                pageSize: 1,
                trackedEntity,
                program: "ueBhWkWll5v",
                order: "occurredAt:DESC",
                fields: "occurredAt",
                programStage: "K2nxbE9ubSs",
            },
        }),
    );
    if (isError) return <div>Error loading last visit data</div>;
    if (isLoading) return <Spinner height="100%" />;
    if (!data || data.events.length === 0) return <div>No visit</div>;
    const lastVisit = data.events[0].occurredAt;
    return (
        <Tag color="green" style={{ fontSize: 16 }}>
            {dayjs(lastVisit).format("DD/MM/YYYY")}
        </Tag>
    );
};
