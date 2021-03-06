import {
  createApi,
  fetchBaseQuery,
  retry,
} from "@rtk-incubator/rtk-query/react";

export interface Post {
  id: number;
  name: string;
  fetched_at: string;
}

type PostsResponse = Post[];

export interface User {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

// Create our baseQuery instance
const baseQuery = fetchBaseQuery({
  baseUrl: "/",
  prepareHeaders: (headers, { getState }) => {
    return headers;
  },
});

const baseQueryWithRetry = retry(baseQuery, { maxRetries: 6 });

export const postApi = createApi({
  reducerPath: "postsApi", // We only specify this because there are many services. This would not be common in most applications
  baseQuery: baseQueryWithRetry,
  entityTypes: ["Posts"],
  endpoints: (build) => ({
    login: build.mutation<{ token: string; user: User }, any>({
      query: (credentials: any) => ({
        url: "login",
        method: "POST",
        body: credentials,
      }),
      extraOptions: {
        backoff: () => {
          // We intentionally error once on login, and this breaks out of retrying. The next login attempt will succeed.
          retry.fail({ fake: "error" });
        },
      },
    }),
    getPosts: build.query<PostsResponse, void>({
      query: () => ({ url: "posts" }),
      provides: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Posts", id } as const)),
              { type: "Posts", id: "LIST" },
            ]
          : [{ type: "Posts", id: "LIST" }],
    }),
    addPost: build.mutation<Post, Partial<Post>>({
      query: (body) => ({
        url: `posts`,
        method: "POST",
        body,
      }),
      invalidates: [{ type: "Posts", id: "LIST" }],
    }),
    getPost: build.query<Post, number>({
      query: (id) => `posts/${id}`,
      provides: (result, error, id) => [{ type: "Posts", id }],
    }),
    updatePost: build.mutation<Post, Partial<Post>>({
      query(data) {
        const { id, ...body } = data;
        return {
          url: `posts/${id}`,
          method: "PUT",
          body,
        };
      },
      invalidates: (result, error, { id }) => [{ type: "Posts", id }],
    }),
    deletePost: build.mutation<{ success: boolean; id: number }, number>({
      query(id) {
        return {
          url: `posts/${id}`,
          method: "DELETE",
        };
      },
      invalidates: (result, error, id) => [{ type: "Posts", id }],
    }),
    getErrorProne: build.query<{ success: boolean }, void>({
      query: () => "error-prone",
    }),
  }),
});

export const {
  useAddPostMutation,
  useDeletePostMutation,
  useGetPostQuery,
  useGetPostsQuery,
  useLoginMutation,
  useUpdatePostMutation,
  useGetErrorProneQuery,
} = postApi;

export const {
  endpoints: { login },
} = postApi;

export const enhancedPostApi = postApi.enhanceEndpoints({
  addTagTypes: ["Pet"],
  endpoints: {
    // basic notation: just specify properties to be overridden
    getPetById: {
      provides: (result, error, arg) => [{ type: "Pet", id: arg.petId }],
    },
    findPetsByStatus: {
      provides: (result) =>
        // is result available?
        result
          ? // successful query
            [
              { type: "Pet", id: "LIST" },
              ...result.map((pet) => ({ type: "Pet" as const, id: pet.id })),
            ]
          : // an error occurred, but we still want to refetch this query when `{ type: 'Pet', id: 'LIST' }` is invalidated
            [{ type: "Pet", id: "LIST" }],
    },
    // alternate notation: callback that gets passed in `endpoint` - you can freely modify the object here
    addPet: (endpoint) => {
      endpoint.invalidates = (result) => [{ type: "Pet", id: result.id }];
    },
    updatePet: {
      invalidates: (result, error, arg) => [{ type: "Pet", id: arg.petId }],
    },
    deletePet: {
      invalidates: (result, error, arg) => [{ type: "Pet", id: arg.petId }],
    },
  },
});
