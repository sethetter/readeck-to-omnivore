async function main() {
  const bookmarks = await getReadeckBookmarks();
  for (const bookmark of bookmarks) {
    try {
      await saveArchivedToOmnivore(bookmark);
    } catch (err: unknown) {
      console.error(err);
    }
  }
}

interface ReadeckArticle {
  url: string;
  created: string;
  labels: string[];
}

async function getReadeckBookmarks(): Promise<ReadeckArticle[]> {
  const response = await fetch(
    `${Deno.env.get("READECK_URL")}/api/bookmarks?is_marked=true`,
    {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${Deno.env.get("READECK_API_KEY")}`,
      },
    }
  );
  if (!response.ok) {
    throw new Error("Failed to fetch bookmarks from readeck", {
      cause: await response.text(),
    });
  }
  const data = await response.json();
  return data;
}

const omnivoreSaveMutation = `
  mutation SaveUrl($input: SaveUrlInput!) {
    saveUrl(input: $input) {
      ... on SaveSuccess {
        url
        clientRequestId
      }
      ... on SaveError {
        errorCodes
        message
      }
    }
  }
`;

const omnivorePayload = (article: ReadeckArticle) => {
  const clientRequestId = crypto.randomUUID();
  const source = "api";
  const url = article.url;
  const labels = article.labels.map((tag) => ({ name: tag }));
  const savedAt = article.created;

  return {
    input: { clientRequestId, url, source, savedAt, labels },
  };
};

async function saveArchivedToOmnivore(bookmark: ReadeckArticle): Promise<void> {
  const response = await fetch(`${Deno.env.get("OMNIVORE_URL")}/api/graphql`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${Deno.env.get("OMNIVORE_API_KEY")}`,
    },
    body: JSON.stringify({
      query: omnivoreSaveMutation,
      variables: omnivorePayload(bookmark),
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to save bookmark to omnivore", {
      cause: await response.text(),
    });
  }
  const data = await response.json();
  console.log(data);
}

async function archiveArticleInOmnivore(linkId: string): Promise<void> {
  const response = await fetch("https://api-prod.omnivore.app/api/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `${Deno.env.get("OMNIVORE_API_KEY")}`,
    },
    body: JSON.stringify({
      query: `
        mutation ArchiveLink($input: ArchiveLinkInput!) {
          setLinkArchived(input: $input) {
            ... on ArchiveLinkSuccess {
              linkId
              message
            }
            ... on ArchiveLinkError {
              errorCodes
              message
            }
          }
        }
      `,
      variables: { input: { linkId, archived: true } },
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to archive article in omnivore", {
      cause: await response.text(),
    });
  }
  const data = await response.json();
  console.log(data);
}

if (import.meta.main) {
  await main();
}
