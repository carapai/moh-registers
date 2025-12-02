import { createRoute } from "@tanstack/react-router";
import { Checkbox, Flex, Space } from "antd";
import React, { useState } from "react";
import { Spinner } from "../components/Spinner";
import PatientListScreen from "../components/patient-list";
import OrgUnitTreeSelect from "../components/tree-select";
import { TrackerContext } from "../machines/tracker";
import { ClientSchema } from "../schemas";
import { RootRoute } from "./__root";
export const TrackedEntitiesRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/tracked-entities",
    component: TrackedEntities,
    validateSearch: ClientSchema,
});

function TrackedEntities() {
    const trackerActor = TrackerContext.useActorRef();

    const orgUnit = TrackerContext.useSelector(
        (state) => state.context.orgUnit,
    );
    return (
        <Flex vertical gap="16px" style={{ height: "100%" }}>
            <OrgUnitTreeSelect
                onChange={(value) => {
                    if (value) {
                        trackerActor.send({
                            type: "SET_ORG_UNIT",
                            orgUnit: value,
                        });
                    }
                }}
                value={orgUnit}
            />
            <PatientListScreen />
        </Flex>
    );
}
