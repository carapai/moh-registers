import type { TreeSelectProps } from "antd";
import { TreeSelect } from "antd";
import { useLiveQuery } from "dexie-react-hooks";
import React from "react";
import { db } from "../db";
import { resourceQueryOptions } from "../query-options";
import { RootRoute } from "../routes/__root";
import { Node, OrgUnit } from "../schemas";

const OrgUnitTreeSelect: React.FC<{
    onChange: (value: string | undefined) => void;
    value: string | undefined;
}> = ({ onChange, value }) => {
    const { queryClient, engine } = RootRoute.useRouteContext();
    const { id: user } = RootRoute.useLoaderData();
    const treeData = useLiveQuery(async () => {
        return await db.organisationUnits.orderBy("title").toArray();
    }, []);

    const onLoadData: TreeSelectProps["loadData"] = async ({
        id,
        children,
    }) => {
        const options = resourceQueryOptions<{ children: OrgUnit[] }>({
            engine,
            resource: "organisationUnits",
            id,
            params: {
                fields: "children[id,name,level,parent,leaf]",
                order: "name:asc",
            },
        });
        const prev = queryClient.getQueryData(options.queryKey);
        if (children === undefined && prev === undefined) {
            const { children } = await queryClient.fetchQuery(options);
            const newTreeNodes: Node[] = children.map((ou) => ({
                id: ou.id,
                pId: ou.parent?.id,
                value: ou.id,
                title: ou.name,
                isLeaf: ou.leaf,
                user,
            }));
            db.organisationUnits.bulkPut(newTreeNodes);
        }
    };

    return (
        <TreeSelect
            treeDataSimpleMode
            style={{ width: "100%" }}
            value={value}
            styles={{
                popup: {
                    root: { maxHeight: 600, overflow: "auto" },
                },
            }}
            placeholder="Please select"
            onChange={onChange}
            loadData={onLoadData}
            treeData={treeData}
        />
    );
};

export default OrgUnitTreeSelect;
