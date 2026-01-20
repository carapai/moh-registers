import { Tabs } from "antd";
import dayjs from "dayjs";
import React from "react";
import { TrackerContext } from "../machines/tracker";
import { BasicTrackedEntity } from "../schemas";
import Relation from "./relation";

// Helper function to get child label from attributes
const getChildLabel = (child: BasicTrackedEntity): string => {
    // Try to get child name attribute (P6Kp91wfCWy is child name ID)
    const nameAttr = child.attributes?.find?.(
        (a) => a.attribute === "P6Kp91wfCWy",
    );

    // Try to get birth date attribute (Y3DE5CZWySr is birth date ID)
    const birthDateAttr = child.attributes?.find?.(
        (a) => a.attribute === "Y3DE5CZWySr",
    );

    if (nameAttr?.value) {
        return nameAttr.value;
    }

    if (birthDateAttr?.value) {
        return `Born ${dayjs(birthDateAttr.value).format("MMM DD, YYYY")}`;
    }

    // Fallback to creation date
    return `Child ${dayjs(child.createdAt).format("MMM DD")}`;
};

export default function RelationshipEvent({ section }: { section: string }) {
    const relationships = TrackerContext.useSelector(
        (state) => state.context.trackedEntity.relationships,
    );

    return (
        <Tabs
            items={relationships.map((relationship) => {
                return {
                    key: relationship.relationship,
                    label: getChildLabel(relationship.to.trackedEntity),
                    children: (
                        <Relation
                            section={section}
                            child={relationship.to.trackedEntity}
                        />
                    ),
                };
            })}
        />
    );
}
