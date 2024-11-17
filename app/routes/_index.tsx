import { useLoaderData } from "@remix-run/react";

export default function Index() {
  const value = useLoaderData<string>();
  return (
    <pre>
      {value}
    </pre>
  );
}

// At the point of module execution, process.env is available.
const value = JSON.stringify(process.env,null,2);

export const loader = ()=>{
  return value
}
