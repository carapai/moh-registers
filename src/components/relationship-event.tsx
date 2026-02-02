import { Tabs } from "antd";
import dayjs from "dayjs";
import { useLiveQuery } from "dexie-react-hooks";
import React from "react";
import { populateRelationshipsForEntity } from "../db/operations";
import { FlattenedTrackedEntity, BasicTrackedEntity } from "../db";
import Relation from "./relation";

const getChildLabel = (child: BasicTrackedEntity): string => {
    const attributes = Array.isArray(child.attributes) ? child.attributes : [];
    const nameAttr = attributes.find((a) => a.attribute === "P6Kp91wfCWy");
    const birthDateAttr = attributes.find((a) => a.attribute === "Y3DE5CZWySr");

    if (nameAttr?.value) {
        return nameAttr.value;
    }

    if (birthDateAttr?.value) {
        return `Born ${dayjs(birthDateAttr.value).format("MMM DD, YYYY")}`;
    }

    return `Child ${dayjs(child.createdAt).format("MMM DD")}`;
};

export default function RelationshipEvent({
    section,
    trackedEntity,
}: {
    section: string;
    trackedEntity: FlattenedTrackedEntity;
}) {
    // Load relationships from DexieDB
    const relationships = useLiveQuery(async () => {
        if (!trackedEntity.trackedEntity) return [];

        try {
            return await populateRelationshipsForEntity(
                trackedEntity.trackedEntity,
            );
        } catch (error) {
            console.error("Failed to load relationships:", error);
            return [];
        }
    }, [trackedEntity.trackedEntity]);

    if (!relationships || relationships.length === 0) {
        return null;
    }

    return (
        <Tabs
            items={relationships.map((relationship) => {
                const child = (relationship.to as any)
                    .trackedEntity as BasicTrackedEntity;

                return {
                    key: relationship.relationship,
                    label: getChildLabel(child),
                    destroyInactiveTabPane: false, // Keep tabs mounted for program rules
                    children: (
                        <Relation
                            key={child.trackedEntity}
                            section={section}
                            child={child}
                        />
                    ),
                };
            })}
        />
    );
}
