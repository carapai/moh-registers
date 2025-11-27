import { createRoute, Outlet } from "@tanstack/react-router";
import { Flex, Table } from "antd";
import React from "react";
import OrgUnitTreeSelect from "../components/tree-select";
import { ClientSchema } from "../schemas";
import { RootRoute } from "./__root";
import { TrackerContext } from "../machines/tracker";
import { getAttributes } from "../utils/utils";
export const TrackedEntitiesRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entities",
    component: TrackedEntities,
    validateSearch: ClientSchema,
});

function TrackedEntities() {
    const { orgUnits } = TrackedEntitiesRoute.useSearch();
    const { program } = RootRoute.useLoaderData();
    const trackedEntities = TrackerContext.useSelector(
        (state) => state.context.trackedEntities,
    );
    const trackerActor = TrackerContext.useActorRef();
    return (
        <Flex vertical gap="16px">
            <OrgUnitTreeSelect onChange={(value) => {}} value={orgUnits} />
            <Table
                dataSource={trackedEntities}
                columns={getAttributes(program.programTrackedEntityAttributes)}
                rowKey="trackedEntity"
                onRow={(record) => {
                    return {
                        onClick: () => {
                            trackerActor.send({
                                type: "SET_TRACKED_ENTITY_ID",
                                trackedEntityId: record.trackedEntity,
                            });
                        },
                        style: { cursor: "pointer" },
                    };
                }}
            />
        </Flex>
    );
}
