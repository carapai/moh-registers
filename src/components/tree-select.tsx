import React, { useState } from "react";
import type { GetProp, TreeSelectProps } from "antd";
import { TreeSelect } from "antd";
import { orderBy } from "lodash";
import { RootRoute } from "../routes/__root";
import { resourceQueryOptions } from "../query-options";
import { OrgUnit } from "../schemas";

type DefaultOptionType = GetProp<TreeSelectProps, "treeData">[number];

const OrgUnitTreeSelect: React.FC<{
    onChange: (value: string | undefined) => void;
    value: string | undefined;
}> = ({ onChange, value }) => {
    const { organisationUnits } = RootRoute.useLoaderData();
    const { queryClient, engine } = RootRoute.useRouteContext();
    const [treeData, setTreeData] = useState<
        Omit<DefaultOptionType, "label">[]
    >(
        organisationUnits.map((ou) => ({
            id: ou.id,
            pId: ou.parent?.id,
            value: ou.id,
            title: ou.name,
            isLeaf: ou.leaf,
        })),
    );

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
            const newTreeNodes = children.map((ou) => ({
                id: ou.id,
                pId: ou.parent?.id,
                value: ou.id,
                title: ou.name,
                isLeaf: ou.leaf,
            }));
            setTreeData((origin) =>
                orderBy([...origin, ...newTreeNodes], "title"),
            );
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
