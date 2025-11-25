import React from "react";
import { ClientsRoute } from "../routes/clients";
import { flattenTrackedEntityResponse } from "../utils/utils";

export default function TrackedEntities() {
    const data = ClientsRoute.useLoaderData();
    return <pre>{JSON.stringify(flattenTrackedEntityResponse(data), null, 2)}</pre>;
}
