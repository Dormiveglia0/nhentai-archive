# nhentai API Reference（AI 编程平衡版）

> 用于放进 AI 编程上下文：保留第三方可用接口的调用契约和必要响应示例；剔除内部、Staff/Superuser、moderation、auth/user 内部流程、zones。

## Global
- Base URL: `https://nhentai.net`
- Headers: `Accept: application/json`, `User-Agent: AppName/version (contact or project URL)`
- JSON body: `Content-Type: application/json`
- API Key: `Authorization: Key YOUR_API_KEY`
- CDN: 先 `GET /api/v2/cdn` 获取 server，再拼接返回的 `path`；不要猜 URL。
- Common errors: `{"error":"string"}`；validation: `{"detail":[{"loc":["string",0],"msg":"string","type":"string","input":"string","ctx":{}}]}`；`429` 退避重试。

## Omitted
- `/api/v2/moderation/*`、Staff/Superuser-only、`/api/v2/auth/*`、除 `GET /api/v2/user` 外的 `/api/v2/user*`、`/api/v2/zones*`。

## Index（47 endpoints）

1. [`GET /api/v2`](#get-api-v2) — Api Root
2. [`GET /api/v2/pow`](#get-api-v2-pow) — Get Pow Challenge
3. [`GET /api/v2/config`](#get-api-v2-config) — Get Config
4. [`GET /api/v2/captcha`](#get-api-v2-captcha) — Get Captcha Info
5. [`GET /api/v2/cdn`](#get-api-v2-cdn) — Get Cdn Config
6. [`GET /api/v2/galleries`](#get-api-v2-galleries) — Get All Galleries
7. [`GET /api/v2/galleries/tagged`](#get-api-v2-galleries-tagged) — Get Galleries By Tag
8. [`GET /api/v2/galleries/popular`](#get-api-v2-galleries-popular) — Get Popular Galleries
9. [`GET /api/v2/galleries/random`](#get-api-v2-galleries-random) — Get Random Gallery
10. [`GET /api/v2/galleries/{gallery_id}`](#get-api-v2-galleries-gallery_id) — Get Gallery
11. [`GET /api/v2/galleries/{gallery_id}/related`](#get-api-v2-galleries-gallery_id-related) — Get Related Galleries
12. [`GET /api/v2/galleries/{gallery_id}/favorite`](#get-api-v2-galleries-gallery_id-favorite) — Check Favorite
13. [`POST /api/v2/galleries/{gallery_id}/favorite`](#post-api-v2-galleries-gallery_id-favorite) — Add To Favorites
14. [`DELETE /api/v2/galleries/{gallery_id}/favorite`](#delete-api-v2-galleries-gallery_id-favorite) — Remove From Favorites
15. [`POST /api/v2/galleries/{gallery_id}/download`](#post-api-v2-galleries-gallery_id-download) — Get a download URL for a gallery
16. [`GET /api/v2/tags/ids`](#get-api-v2-tags-ids) — Get Tags By Ids
17. [`POST /api/v2/tags/search`](#post-api-v2-tags-search) — Search Tags
18. [`GET /api/v2/tags/{tag_type}`](#get-api-v2-tags-tag_type) — Get Tags By Type
19. [`GET /api/v2/tags/{tag_type}/{slug}`](#get-api-v2-tags-tag_type-slug) — Get Tag By Slug
20. [`GET /api/v2/galleries/{gallery_id}/suggestions`](#get-api-v2-galleries-gallery_id-suggestions) — List Gallery Suggestions
21. [`POST /api/v2/galleries/{gallery_id}/suggestions`](#post-api-v2-galleries-gallery_id-suggestions) — Create Suggestion
22. [`GET /api/v2/gts/backlog`](#get-api-v2-gts-backlog) — List Gts Backlog
23. [`GET /api/v2/gts/new-tags`](#get-api-v2-gts-new-tags) — List New Tag Index
24. [`POST /api/v2/galleries/{gallery_id}/suggestions/{suggestion_id}/vote`](#post-api-v2-galleries-gallery_id-suggestions-suggestion_id-vote) — Vote On Suggestion
25. [`DELETE /api/v2/galleries/{gallery_id}/suggestions/{suggestion_id}`](#delete-api-v2-galleries-gallery_id-suggestions-suggestion_id) — Withdraw Suggestion
26. [`GET /api/v2/taxonomy`](#get-api-v2-taxonomy) — List Taxonomy Suggestions
27. [`POST /api/v2/taxonomy`](#post-api-v2-taxonomy) — Create Taxonomy Suggestion
28. [`GET /api/v2/taxonomy/stats`](#get-api-v2-taxonomy-stats) — Get Taxonomy Suggestion Stats
29. [`GET /api/v2/taxonomy/resolved`](#get-api-v2-taxonomy-resolved) — List Resolved Taxonomy Suggestions
30. [`GET /api/v2/taxonomy/{suggestion_id}`](#get-api-v2-taxonomy-suggestion_id) — Get Taxonomy Suggestion
31. [`DELETE /api/v2/taxonomy/{suggestion_id}`](#delete-api-v2-taxonomy-suggestion_id) — Withdraw Taxonomy Suggestion
32. [`GET /api/v2/taxonomy/{suggestion_id}/comments`](#get-api-v2-taxonomy-suggestion_id-comments) — List Taxonomy Comments
33. [`POST /api/v2/taxonomy/{suggestion_id}/comments`](#post-api-v2-taxonomy-suggestion_id-comments) — Create Taxonomy Comment
34. [`DELETE /api/v2/taxonomy/{suggestion_id}/comments/{comment_id}`](#delete-api-v2-taxonomy-suggestion_id-comments-comment_id) — Delete Taxonomy Comment
35. [`POST /api/v2/taxonomy/{suggestion_id}/vote`](#post-api-v2-taxonomy-suggestion_id-vote) — Vote On Taxonomy Suggestion
36. [`GET /api/v2/search`](#get-api-v2-search) — Search Galleries
37. [`GET /api/v2/galleries/{gallery_id}/comments`](#get-api-v2-galleries-gallery_id-comments) — Get Gallery Comments
38. [`POST /api/v2/galleries/{gallery_id}/comments`](#post-api-v2-galleries-gallery_id-comments) — Create Comment
39. [`GET /api/v2/galleries/{gallery_id}/comments/count`](#get-api-v2-galleries-gallery_id-comments-count) — Get Gallery Comment Count
40. [`DELETE /api/v2/comments/{comment_id}`](#delete-api-v2-comments-comment_id) — Delete Comment
41. [`POST /api/v2/comments/{comment_id}/flag`](#post-api-v2-comments-comment_id-flag) — Flag Comment
42. [`GET /api/v2/favorites`](#get-api-v2-favorites) — Get Favorites
43. [`GET /api/v2/favorites/random`](#get-api-v2-favorites-random) — Get Random Favorite
44. [`GET /api/v2/blacklist`](#get-api-v2-blacklist) — Get Blacklist
45. [`POST /api/v2/blacklist`](#post-api-v2-blacklist) — Update Blacklist
46. [`GET /api/v2/blacklist/ids`](#get-api-v2-blacklist-ids) — Get Blacklist Ids
47. [`GET /api/v2/user`](#get-api-v2-user) — Get Me

---

## default

<a id="get-api-v2"></a>

### `GET /api/v2` — Api Root

- Desc: API root.
- Auth: Public (no authentication required)
- 200: version:string, message:string
- Status: 200:Successful Response
- Response 200 shape:
```json
{
  "version": "string",
  "message": "string"
}
```

<a id="get-api-v2-pow"></a>

### `GET /api/v2/pow` — Get Pow Challenge

- Desc: Get a new proof of work challenge. Optionally specify action for per-action difficulty.
- Auth: Public (no authentication required)
- Params: query.action?:string \[def=null);enum=no]
- 200: challenge:string, difficulty:integer
- Status: 200:Successful Response, 422:Validation Error
- Response 200 shape:
```json
{
  "challenge": "string",
  "difficulty": 0
}
```

<a id="get-api-v2-config"></a>

### `GET /api/v2/config` — Get Config

- Desc: Get app config: CDN servers and current announcement.
- Auth: Public (no authentication required)
- 200: image_servers:array, image_servers[]:string, thumb_servers:array, thumb_servers[]:string, announcement:object
- Status: 200:Successful Response
- Response 200 shape:
```json
{
  "image_servers": [
    "string"
  ],
  "thumb_servers": [
    "string"
  ],
  "announcement": {
    "message": "string",
    "links": []
  }
}
```

<a id="get-api-v2-captcha"></a>

### `GET /api/v2/captcha` — Get Captcha Info

- Desc: Get CAPTCHA provider info for the frontend widget.
- Auth: Public (no authentication required)
- 200: provider:string, site_key:string
- Status: 200:Successful Response
- Response 200 shape:
```json
{
  "provider": "string",
  "site_key": "string"
}
```

## cdn

<a id="get-api-v2-cdn"></a>

### `GET /api/v2/cdn` — Get Cdn Config

- Desc: Get CDN server configuration for media URLs.
- Auth: Public (no authentication required)
- 200: image_servers:array, image_servers[]:string, thumb_servers:array, thumb_servers[]:string
- Status: 200:Successful Response
- Response 200 shape:
```json
{
  "image_servers": [
    "string"
  ],
  "thumb_servers": [
    "string"
  ]
}
```

## galleries

<a id="get-api-v2-galleries"></a>

### `GET /api/v2/galleries` — Get All Galleries

- Desc: Get paginated galleries ordered by newest first.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 15/1min per IP<br>30/1min per IP
- Params: query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=25;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0
}
```

<a id="get-api-v2-galleries-tagged"></a>

### `GET /api/v2/galleries/tagged` — Get Galleries By Tag

- Desc: Get galleries with a specific tag.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 15/1min per IP<br>30/1min per IP
- Params: query.tag_id!:integer, query.sort?:string[def=date;enum=date, popular, popular-today, popular-week, popular-month], query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=25;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0
}
```

<a id="get-api-v2-galleries-popular"></a>

### `GET /api/v2/galleries/popular` — Get Popular Galleries

- Desc: Get today's popular galleries.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 8/1min per IP
- 200: [].id:integer, [].media_id:string, [].english_title:string, [].japanese_title:string, [].thumbnail:string, [].thumbnail_width:integer, [].thumbnail_height:integer, [].num_pages:integer, [].num_favorites:integer, [].tag_ids:array, [].blacklisted:boolean
- Status: 200:Successful Response, 429:Too many requests
- Response 200 shape:
```json
[
  {
    "id": 0,
    "media_id": "string",
    "english_title": "string",
    "japanese_title": "string",
    "thumbnail": "string",
    "thumbnail_width": 0,
    "thumbnail_height": 0,
    "num_pages": 0,
    "num_favorites": 0,
    "tag_ids": [],
    "blacklisted": false
  }
]
```

<a id="get-api-v2-galleries-random"></a>

### `GET /api/v2/galleries/random` — Get Random Gallery

- Desc: Get a random gallery ID.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 20/1min per IP<br>30/1min per IP
- 200: additionalProp1:object
- Status: 200:Successful Response, 429:Too many requests
- Response 200 shape:
```json
{
  "additionalProp1": {}
}
```

<a id="get-api-v2-galleries-gallery_id"></a>

### `GET /api/v2/galleries/{gallery_id}` — Get Gallery

- Desc: Get a single gallery with full details and optional includes.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 20/1min per IP<br>45/1min per IP
- Params: path.gallery_id!:integer, query.include?:string
- 200: id:integer, media_id:string, title:object, cover:object, thumbnail:object, scanlator:string, upload_date:integer, tags:array, tags[]:object, num_pages:integer, num_favorites:integer, pages:array, comments:array, comments[]:object, comment_count:integer, related:array, related[]:object, is_favorited:boolean, suggestions:object
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "id": 0,
  "media_id": "string",
  "title": {
    "english": "string",
    "japanese": "string",
    "pretty": "string"
  },
  "cover": {
    "path": "string",
    "width": 0,
    "height": 0
  },
  "thumbnail": {
    "path": "string",
    "width": 0,
    "height": 0
  },
  "scanlator": "string",
  "upload_date": 0,
  "tags": [
    {
      "id": 0,
      "type": "string",
      "name": "string",
      "slug": "string",
      "url": "string",
      "count": 0,
      "description": "string",
      "is_community": false,
      "pending_describe_id": "string"
    }
  ],
  "num_pages": 0,
  "num_favorites": 0,
  "pages": [],
  "comments": [
    {
      "id": 0,
      "gallery_id": 0,
      "poster": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string",
        "is_superuser": false,
        "is_staff": false
      },
      "post_date": 0,
      "body": "string"
    }
  ],
  "comment_count": 0,
  "related": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ],
  "is_favorited": false,
  "suggestions": {
    "trending": [
      {
        "id": "string",
        "gallery_id": 0,
        "tag": {
          "id": 0,
          "type": "string",
          "name": "string",
          "slug": "string",
          "url": "string",
          "description": "string"
        },
        "action": "string",
        "status": "string",
        "score": 0,
        "voter_count": 0,
        "proposer": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "created_at": "string",
        "resolved_at": "string",
        "resolver": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "resolution_note": "string",
        "reverted_at": "string",
        "reverter": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "my_vote": 0,
        "tier": "string"
      }
    ],
    "active": [
      {
        "id": "string",
        "gallery_id": 0,
        "tag": {
          "id": 0,
          "type": "string",
          "name": "string",
          "slug": "string",
          "url": "string",
          "description": "string"
        },
        "action": "string",
        "status": "string",
        "score": 0,
        "voter_count": 0,
        "proposer": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "created_at": "string",
        "resolved_at": "string",
        "resolver": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "resolution_note": "string",
        "reverted_at": "string",
        "reverter": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "my_vote": 0,
        "tier": "string"
      }
    ],
    "mine": [],
    "counts": {
      "trending": 0,
      "active": 0,
      "declined": 0,
      "hidden": 0
    }
  }
}
```

<a id="get-api-v2-galleries-gallery_id-related"></a>

### `GET /api/v2/galleries/{gallery_id}/related` — Get Related Galleries

- Desc: Get galleries similar to the specified gallery.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 12/1min per IP<br>30/1min per IP
- Params: path.gallery_id!:integer
- 200: result:array, result[]:object
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ]
}
```

<a id="get-api-v2-galleries-gallery_id-favorite"></a>

### `GET /api/v2/galleries/{gallery_id}/favorite` — Check Favorite

- Desc: Check if a gallery is in the user's favorites.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner
- Params: path.gallery_id!:integer
- 200: favorited:boolean, num_favorites:integer
- Status: 200:Successful Response, 401:Unauthorized, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "favorited": false,
  "num_favorites": 0
}
```

<a id="post-api-v2-galleries-gallery_id-favorite"></a>

### `POST /api/v2/galleries/{gallery_id}/favorite` — Add To Favorites

- Desc: Add a gallery to the current user's favorites.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner<br>15/1min per IP + user<br>15/1min per IP + API key owner
- Params: path.gallery_id!:integer
- 200: favorited:boolean, num_favorites:integer
- Status: 200:Successful Response, 401:Unauthorized, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "favorited": false,
  "num_favorites": 0
}
```

<a id="delete-api-v2-galleries-gallery_id-favorite"></a>

### `DELETE /api/v2/galleries/{gallery_id}/favorite` — Remove From Favorites

- Desc: Remove a gallery from the current user's favorites.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner<br>15/1min per IP + user<br>15/1min per IP + API key owner
- Params: path.gallery_id!:integer
- 200: favorited:boolean, num_favorites:integer
- Status: 200:Successful Response, 401:Unauthorized, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "favorited": false,
  "num_favorites": 0
}
```

<a id="post-api-v2-galleries-gallery_id-download"></a>

### `POST /api/v2/galleries/{gallery_id}/download` — Get a download URL for a gallery

- Desc: Returns a short-lived URL for the gallery as a zip, cbz, or torrent file. Fetch url before expires_at (unix timestamp).
- Auth: User Token or API Key
- Rate: 5/1min per IP<br>10/5min per user<br>5/1min per API key owner<br>10/5min per IP<br>7/5min per user<br>10/5min per API key owner
- Params: path.gallery_id!:integer, query.format?:string
- 200: url:string, expires_at:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "url": "string",
  "expires_at": 0
}
```

## tags

<a id="get-api-v2-tags-ids"></a>

### `GET /api/v2/tags/ids` — Get Tags By Ids

- Desc: Look up multiple tags by ID. Max 100 per request.
- Auth: Public (no authentication required)
- Rate: 15/1min per IP
- Params: query.ids!:string
- 200: [].id:integer, [].type:string, [].name:string, [].slug:string, [].url:string, [].count:integer, [].description:string, [].is_community:boolean, [].pending_describe_id:string
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
[
  {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string",
    "is_community": false,
    "pending_describe_id": "string"
  }
]
```

<a id="post-api-v2-tags-search"></a>

### `POST /api/v2/tags/search` — Search Tags

- Desc: Search tags by name prefix. Omit type to search across all tag types.
- Auth: Public (no authentication required)
- Rate: 30/1min per IP
- Body: {"type":"string","query":"string","limit":10}
- 200: [].id:integer, [].type:string, [].name:string, [].slug:string, [].url:string, [].count:integer, [].description:string, [].is_community:boolean, [].pending_describe_id:string
- Status: 200:Successful Response, 400:Bad Request, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
[
  {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string",
    "is_community": false,
    "pending_describe_id": "string"
  }
]
```

<a id="get-api-v2-tags-tag_type"></a>

### `GET /api/v2/tags/{tag_type}` — Get Tags By Type

- Desc: Get tags of a specific type with pagination. Supports both page-based and cursor-based pagination.
- Auth: Public (no authentication required)
- Rate: 15/1min per IP<br>30/1min per IP
- Params: path.tag_type!:string, query.sort?:string[def=popular;enum=name, popular], query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=25;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer, alphabet:object
- Status: 200:Successful Response, 400:Bad Request, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "type": "string",
      "name": "string",
      "slug": "string",
      "url": "string",
      "count": 0,
      "description": "string",
      "is_community": false,
      "pending_describe_id": "string"
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0,
  "alphabet": {
    "additionalProp1": [
      0
    ],
    "additionalProp2": [
      0
    ],
    "additionalProp3": [
      0
    ]
  }
}
```

<a id="get-api-v2-tags-tag_type-slug"></a>

### `GET /api/v2/tags/{tag_type}/{slug}` — Get Tag By Slug

- Desc: Get a specific tag by type and slug.
- Auth: Public (no authentication required)
- Rate: 15/1min per IP<br>30/1min per IP
- Params: path.tag_type!:string, path.slug!:string
- 200: id:integer, type:string, name:string, slug:string, url:string, count:integer, description:string, is_community:boolean, pending_describe_id:string
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "id": 0,
  "type": "string",
  "name": "string",
  "slug": "string",
  "url": "string",
  "count": 0,
  "description": "string",
  "is_community": false,
  "pending_describe_id": "string"
}
```

## GTS

<a id="get-api-v2-galleries-gallery_id-suggestions"></a>

### `GET /api/v2/galleries/{gallery_id}/suggestions` — List Gallery Suggestions

- Desc: List current tag-change proposals on a gallery.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 60/1min per IP
- Params: path.gallery_id!:integer, query.tier?:string[def=all;pattern: ^(all\], query.limit?:integer[def=20;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, has_more:boolean, num_pages:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "id": "string",
      "gallery_id": 0,
      "tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "description": "string"
      },
      "action": "string",
      "status": "string",
      "score": 0,
      "voter_count": 0,
      "proposer": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "created_at": "string",
      "resolved_at": "string",
      "resolver": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "resolution_note": "string",
      "reverted_at": "string",
      "reverter": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "my_vote": 0,
      "tier": "string"
    }
  ],
  "has_more": false,
  "num_pages": 0,
  "total": 0
}
```

<a id="post-api-v2-galleries-gallery_id-suggestions"></a>

### `POST /api/v2/galleries/{gallery_id}/suggestions` — Create Suggestion

- Desc: Propose adding or removing a tag on a gallery. If a matching proposal already exists, your call adds your vote to it instead of creating a duplicate.
- Auth: User Token required
- Rate: 10/1h per user<br>30/1h per IP
- Params: path.gallery_id!:integer
- Body: {"tag_id":1,"action":"add","captcha_response":"string","pow_challenge":"string","pow_nonce":"string"}
- 200: id:string, gallery_id:integer, tag:object, action:string, status:string, score:integer, voter_count:integer, proposer:object, created_at:string, resolved_at:string, resolver:object, resolution_note:string, reverted_at:string, reverter:object, my_vote:integer, tier:string
- Status: 200:Successful Response, 400:Bad Request, 403:Forbidden, 409:Conflict, 422:Validation Error, 429:Too Many Requests, 503:Service Unavailable
- Response 200 shape:
```json
{
  "id": "string",
  "gallery_id": 0,
  "tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "description": "string"
  },
  "action": "string",
  "status": "string",
  "score": 0,
  "voter_count": 0,
  "proposer": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "created_at": "string",
  "resolved_at": "string",
  "resolver": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "resolution_note": "string",
  "reverted_at": "string",
  "reverter": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "my_vote": 0,
  "tier": "string"
}
```

<a id="get-api-v2-gts-backlog"></a>

### `GET /api/v2/gts/backlog` — List Gts Backlog

- Desc: List pending tag-change suggestions across galleries.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 60/1min per IP
- Params: query.page?:integer[def=1;maximum: 200, minimum: 1], query.per_page?:integer[def=20;maximum: 50, minimum: 1], query.tag_id?:integer \[def=null);enum=no], query.action?:string \[def=null);enum=no], query.sort_by?:string[def=starvation;pattern: ^(starvation\], query.sort?:string[def=asc;pattern: ^(asc\]
- 200: result:array, result[]:object, has_more:boolean, num_pages:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "suggestion": {
        "id": "string",
        "gallery_id": 0,
        "tag": {
          "id": 0,
          "type": "string",
          "name": "string",
          "slug": "string",
          "url": "string",
          "description": "string"
        },
        "action": "string",
        "status": "string",
        "score": 0,
        "voter_count": 0,
        "proposer": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "created_at": "string",
        "resolved_at": "string",
        "resolver": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "resolution_note": "string",
        "reverted_at": "string",
        "reverter": {
          "id": 0,
          "username": "string",
          "slug": "string",
          "avatar_url": "string"
        },
        "my_vote": 0,
        "tier": "string"
      },
      "gallery": {
        "id": 0,
        "media_id": "string",
        "thumbnail": "string",
        "thumbnail_width": 0,
        "thumbnail_height": 0,
        "english_title": "string",
        "japanese_title": "string",
        "num_pages": 0,
        "num_favorites": 0,
        "upload_date": 0,
        "age_days": 0,
        "tags": []
      }
    }
  ],
  "has_more": false,
  "num_pages": 0,
  "total": 0
}
```

<a id="get-api-v2-gts-new-tags"></a>

### `GET /api/v2/gts/new-tags` — List New Tag Index

- Desc: List the most recently community-minted tags.
- Auth: Public (no authentication required)
- Rate: 60/1min per IP
- Params: query.limit?:integer[def=25;maximum: 50, minimum: 1]
- 200: result:array, result[]:object
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string",
        "is_community": false,
        "pending_describe_id": "string"
      },
      "created_at": 0,
      "pending_gts_count": 0
    }
  ]
}
```

<a id="post-api-v2-galleries-gallery_id-suggestions-suggestion_id-vote"></a>

### `POST /api/v2/galleries/{gallery_id}/suggestions/{suggestion_id}/vote` — Vote On Suggestion

- Desc: Up/down vote on a suggestion. Pass vote=0 to clear your vote.
- Auth: User Token required
- Rate: 80/1h per user<br>240/1h per IP
- Params: path.gallery_id!:integer, path.suggestion_id!:string ($uuid)
- Body: {"vote":-1,"pow_challenge":"string","pow_nonce":"string"}
- 200: id:string, gallery_id:integer, tag:object, action:string, status:string, score:integer, voter_count:integer, proposer:object, created_at:string, resolved_at:string, resolver:object, resolution_note:string, reverted_at:string, reverter:object, my_vote:integer, tier:string
- Status: 200:Successful Response, 400:Bad Request, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Service Unavailable
- Response 200 shape:
```json
{
  "id": "string",
  "gallery_id": 0,
  "tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "description": "string"
  },
  "action": "string",
  "status": "string",
  "score": 0,
  "voter_count": 0,
  "proposer": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "created_at": "string",
  "resolved_at": "string",
  "resolver": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "resolution_note": "string",
  "reverted_at": "string",
  "reverter": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "my_vote": 0,
  "tier": "string"
}
```

<a id="delete-api-v2-galleries-gallery_id-suggestions-suggestion_id"></a>

### `DELETE /api/v2/galleries/{gallery_id}/suggestions/{suggestion_id}` — Withdraw Suggestion

- Desc: Proposer withdraws their own pending suggestion.
- Auth: User Token required
- Rate: 20/1h per user
- Params: path.gallery_id!:integer, path.suggestion_id!:string ($uuid)
- 200: additionalProp1:object
- Status: 200:Successful Response, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "additionalProp1": {}
}
```

## taxonomy

<a id="get-api-v2-taxonomy"></a>

### `GET /api/v2/taxonomy` — List Taxonomy Suggestions

- Desc: List pending tag suggestions.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 120/1min per IP
- Params: query.tier?:string[def=all;pattern: ^(all\], query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=50;maximum: 200, minimum: 1], query.q?:string \[def=null);enum=no], query.target_tag_id?:integer \[def=null);enum=no], query.sort_by?:string[def=score;pattern: ^(score\], query.sort?:string[def=desc;pattern: ^(asc\], query.action?:string \[def=null);enum=no], query.discussion?:string \[def=null);enum=no]
- 200: result:array, result[]:object, has_more:boolean, num_pages:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "id": "string",
      "action": "string",
      "status": "string",
      "score": 0,
      "voter_count": 0,
      "proposer": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "proposer_note": "string",
      "created_at": "string",
      "resolved_at": "string",
      "resolution_note": "string",
      "resolver": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "target_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "merge_into_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "new_name": "string",
      "new_type": "string",
      "new_description": "string",
      "accepted_type": "string",
      "accepted_name": "string",
      "accepted_description": "string",
      "resolved_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "my_vote": 0,
      "tier": "string",
      "tier_page": 0,
      "comment_count": 0,
      "recent_comments": []
    }
  ],
  "has_more": false,
  "num_pages": 0,
  "total": 0
}
```

<a id="post-api-v2-taxonomy"></a>

### `POST /api/v2/taxonomy` — Create Taxonomy Suggestion

- Desc: Submit a tag suggestion.
- Auth: User Token required
- Rate: 4/4h per user<br>12/4h per IP
- Body: {"action":"create","target_tag_id":1,"merge_into_tag_id":1,"new_name":"string","new_type":"tag","new_description":"string","proposer_note":"string","captcha_response":"string","pow_challenge":"string","pow_nonce":"string"}
- 200: id:string, action:string, status:string, score:integer, voter_count:integer, proposer:object, proposer_note:string, created_at:string, resolved_at:string, resolution_note:string, resolver:object, target_tag:object, merge_into_tag:object, new_name:string, new_type:string, new_description:string, accepted_type:string, accepted_name:string, accepted_description:string, resolved_tag:object, my_vote:integer, tier:string, tier_page:integer, comment_count:integer, recent_comments:array
- Status: 200:Successful Response, 400:Bad Request, 403:Forbidden, 409:Conflict, 422:Validation Error, 429:Too Many Requests, 503:Service Unavailable
- Response 200 shape:
```json
{
  "id": "string",
  "action": "string",
  "status": "string",
  "score": 0,
  "voter_count": 0,
  "proposer": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "proposer_note": "string",
  "created_at": "string",
  "resolved_at": "string",
  "resolution_note": "string",
  "resolver": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "target_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "merge_into_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "new_name": "string",
  "new_type": "string",
  "new_description": "string",
  "accepted_type": "string",
  "accepted_name": "string",
  "accepted_description": "string",
  "resolved_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "my_vote": 0,
  "tier": "string",
  "tier_page": 0,
  "comment_count": 0,
  "recent_comments": []
}
```

<a id="get-api-v2-taxonomy-stats"></a>

### `GET /api/v2/taxonomy/stats` — Get Taxonomy Suggestion Stats

- Desc: Taxonomy activity summary: pending count + recently-accepted suggestions.
- Auth: Public (no authentication required)
- Rate: 30/1min per IP
- 200: pending:integer, accepted_total:integer, rejected_total:integer, accepted_30d:integer, accepted_7d:integer, created_30d:integer, renamed_30d:integer, merged_30d:integer, described_30d:integer, trending_count:integer, active_count:integer, declined_count:integer, recent_accepted:array, recent_accepted[]:object
- Status: 200:Successful Response, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "pending": 0,
  "accepted_total": 0,
  "rejected_total": 0,
  "accepted_30d": 0,
  "accepted_7d": 0,
  "created_30d": 0,
  "renamed_30d": 0,
  "merged_30d": 0,
  "described_30d": 0,
  "trending_count": 0,
  "active_count": 0,
  "declined_count": 0,
  "recent_accepted": [
    {
      "id": "string",
      "action": "string",
      "status": "string",
      "score": 0,
      "voter_count": 0,
      "proposer": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "proposer_note": "string",
      "created_at": "string",
      "resolved_at": "string",
      "resolution_note": "string",
      "resolver": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "target_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "merge_into_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "new_name": "string",
      "new_type": "string",
      "new_description": "string",
      "accepted_type": "string",
      "accepted_name": "string",
      "accepted_description": "string",
      "resolved_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "my_vote": 0,
      "tier": "string",
      "tier_page": 0,
      "comment_count": 0,
      "recent_comments": []
    }
  ]
}
```

<a id="get-api-v2-taxonomy-resolved"></a>

### `GET /api/v2/taxonomy/resolved` — List Resolved Taxonomy Suggestions

- Desc: List resolved tag suggestions.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 90/1min per IP
- Params: query.status?:string[def=all;pattern: ^(all\], query.q?:string \[def=null);enum=no], query.discussion?:string \[def=null);enum=no], query.action?:string \[def=null);enum=no], query.sort_by?:string[def=resolved_at;pattern: ^(resolved_at\], query.sort?:string[def=desc;pattern: ^(asc\], query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=25;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, has_more:boolean, num_pages:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "id": "string",
      "action": "string",
      "status": "string",
      "score": 0,
      "voter_count": 0,
      "proposer": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "proposer_note": "string",
      "created_at": "string",
      "resolved_at": "string",
      "resolution_note": "string",
      "resolver": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string"
      },
      "target_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "merge_into_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "new_name": "string",
      "new_type": "string",
      "new_description": "string",
      "accepted_type": "string",
      "accepted_name": "string",
      "accepted_description": "string",
      "resolved_tag": {
        "id": 0,
        "type": "string",
        "name": "string",
        "slug": "string",
        "url": "string",
        "count": 0,
        "description": "string"
      },
      "my_vote": 0,
      "tier": "string",
      "tier_page": 0,
      "comment_count": 0,
      "recent_comments": []
    }
  ],
  "has_more": false,
  "num_pages": 0,
  "total": 0
}
```

<a id="get-api-v2-taxonomy-suggestion_id"></a>

### `GET /api/v2/taxonomy/{suggestion_id}` — Get Taxonomy Suggestion

- Desc: Fetch a tag suggestion with its latest comment preview.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 120/1min per IP
- Params: path.suggestion_id!:string ($uuid)
- 200: id:string, action:string, status:string, score:integer, voter_count:integer, proposer:object, proposer_note:string, created_at:string, resolved_at:string, resolution_note:string, resolver:object, target_tag:object, merge_into_tag:object, new_name:string, new_type:string, new_description:string, accepted_type:string, accepted_name:string, accepted_description:string, resolved_tag:object, my_vote:integer, tier:string, tier_page:integer, comment_count:integer, recent_comments:array
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "id": "string",
  "action": "string",
  "status": "string",
  "score": 0,
  "voter_count": 0,
  "proposer": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "proposer_note": "string",
  "created_at": "string",
  "resolved_at": "string",
  "resolution_note": "string",
  "resolver": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "target_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "merge_into_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "new_name": "string",
  "new_type": "string",
  "new_description": "string",
  "accepted_type": "string",
  "accepted_name": "string",
  "accepted_description": "string",
  "resolved_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "my_vote": 0,
  "tier": "string",
  "tier_page": 0,
  "comment_count": 0,
  "recent_comments": []
}
```

<a id="delete-api-v2-taxonomy-suggestion_id"></a>

### `DELETE /api/v2/taxonomy/{suggestion_id}` — Withdraw Taxonomy Suggestion

- Desc: Withdraw your pending tag suggestion.
- Auth: User Token required
- Rate: 10/1h per user<br>20/1h per IP
- Params: path.suggestion_id!:string ($uuid)
- 200: additionalProp1:object
- Status: 200:Successful Response, 403:Forbidden, 404:Not Found, 409:Conflict, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "additionalProp1": {}
}
```

<a id="get-api-v2-taxonomy-suggestion_id-comments"></a>

### `GET /api/v2/taxonomy/{suggestion_id}/comments` — List Taxonomy Comments

- Desc: List comments on a tag suggestion.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 120/1min per IP
- Params: path.suggestion_id!:string ($uuid), query.page?:integer[def=1;minimum: 1], query.per_page?:integer[def=50;maximum: 100, minimum: 1]
- 200: result:array, result[]:object, has_more:boolean, num_pages:integer, total:integer
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "result": [
    {
      "id": "string",
      "body": "string",
      "author": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string",
        "is_staff": false,
        "is_superuser": false
      },
      "created_at": "string",
      "can_delete": false,
      "link_previews": []
    }
  ],
  "has_more": false,
  "num_pages": 0,
  "total": 0
}
```

<a id="post-api-v2-taxonomy-suggestion_id-comments"></a>

### `POST /api/v2/taxonomy/{suggestion_id}/comments` — Create Taxonomy Comment

- Desc: Post a comment on a tag suggestion.
- Auth: User Token required
- Rate: 5/15min per user<br>5/15min per IP + user<br>10/15min per IP
- Params: path.suggestion_id!:string ($uuid)
- Body: {"body":"stringstri","captcha_response":"string","pow_challenge":"string","pow_nonce":"string"}
- 200: id:string, body:string, author:object, created_at:string, can_delete:boolean, link_previews:array
- Status: 200:Successful Response, 400:Bad Request, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Service Unavailable
- Response 200 shape:
```json
{
  "id": "string",
  "body": "string",
  "author": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string",
    "is_staff": false,
    "is_superuser": false
  },
  "created_at": "string",
  "can_delete": false,
  "link_previews": []
}
```

<a id="delete-api-v2-taxonomy-suggestion_id-comments-comment_id"></a>

### `DELETE /api/v2/taxonomy/{suggestion_id}/comments/{comment_id}` — Delete Taxonomy Comment

- Desc: Delete a comment. Authors can delete their own; moderators can delete any.
- Auth: User Token required
- Rate: 30/15min per user<br>60/15min per IP
- Params: path.suggestion_id!:string ($uuid), path.comment_id!:string ($uuid)
- 200: additionalProp1:object
- Status: 200:Successful Response, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "additionalProp1": {}
}
```

<a id="post-api-v2-taxonomy-suggestion_id-vote"></a>

### `POST /api/v2/taxonomy/{suggestion_id}/vote` — Vote On Taxonomy Suggestion

- Desc: Vote on a tag suggestion. Pass vote=0 to clear.
- Auth: User Token required
- Rate: 30/1h per user<br>60/1h per IP
- Params: path.suggestion_id!:string ($uuid)
- Body: {"vote":-1,"pow_challenge":"string","pow_nonce":"string"}
- 200: id:string, action:string, status:string, score:integer, voter_count:integer, proposer:object, proposer_note:string, created_at:string, resolved_at:string, resolution_note:string, resolver:object, target_tag:object, merge_into_tag:object, new_name:string, new_type:string, new_description:string, accepted_type:string, accepted_name:string, accepted_description:string, resolved_tag:object, my_vote:integer, tier:string, tier_page:integer, comment_count:integer, recent_comments:array
- Status: 200:Successful Response, 400:Bad Request, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Service Unavailable
- Response 200 shape:
```json
{
  "id": "string",
  "action": "string",
  "status": "string",
  "score": 0,
  "voter_count": 0,
  "proposer": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "proposer_note": "string",
  "created_at": "string",
  "resolved_at": "string",
  "resolution_note": "string",
  "resolver": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string"
  },
  "target_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "merge_into_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "new_name": "string",
  "new_type": "string",
  "new_description": "string",
  "accepted_type": "string",
  "accepted_name": "string",
  "accepted_description": "string",
  "resolved_tag": {
    "id": 0,
    "type": "string",
    "name": "string",
    "slug": "string",
    "url": "string",
    "count": 0,
    "description": "string"
  },
  "my_vote": 0,
  "tier": "string",
  "tier_page": 0,
  "comment_count": 0,
  "recent_comments": []
}
```

## search

<a id="get-api-v2-search"></a>

### `GET /api/v2/search` — Search Galleries

- Desc: Search galleries. Supports: Keywords: word Exact phrases: "exact phrase" Negation: -word , -"exact phrase" , -artist:name Tag filters: artist:name , language:english , tag:"big breasts" Numeric filters: pages:>10 , favorites:>=100 Date filters: uploaded:<7d , uploaded:>1m
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 10/1min per IP<br>20/1min per IP
- Params: query.query!:string[minLength: 1], query.sort?:string[def=date;enum=date, popular, popular-today, popular-week, popular-month], query.page?:integer[def=1;minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer
- Status: 200:Successful Response, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0
}
```

## comments

<a id="get-api-v2-galleries-gallery_id-comments"></a>

### `GET /api/v2/galleries/{gallery_id}/comments` — Get Gallery Comments

- Desc: Paginated list of visible comments on a gallery, newest first.
- Auth: Public (optional User Token or API Key for personalization)
- Rate: 30/1min per IP<br>60/1min per IP
- Params: path.gallery_id!:integer, query.page?:integer[def=1;maximum: 2000, minimum: 1], query.per_page?:integer[def=50;maximum: 50, minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "gallery_id": 0,
      "poster": {
        "id": 0,
        "username": "string",
        "slug": "string",
        "avatar_url": "string",
        "is_superuser": false,
        "is_staff": false
      },
      "post_date": 0,
      "body": "string"
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0
}
```

<a id="post-api-v2-galleries-gallery_id-comments"></a>

### `POST /api/v2/galleries/{gallery_id}/comments` — Create Comment

- Desc: Create a new comment on a gallery.
- Auth: User Token required
- Rate: 5/15min per user<br>5/15min per IP + user<br>10/15min per IP
- Params: path.gallery_id!:integer
- Body: {"body":"stringstri","captcha_response":"string","pow_challenge":"string","pow_nonce":"string"}
- 200: id:integer, gallery_id:integer, poster:object, post_date:integer, body:string
- Status: 200:Successful Response, 400:Bad Request, 401:Unauthorized, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "id": 0,
  "gallery_id": 0,
  "poster": {
    "id": 0,
    "username": "string",
    "slug": "string",
    "avatar_url": "string",
    "is_superuser": false,
    "is_staff": false
  },
  "post_date": 0,
  "body": "string"
}
```

<a id="get-api-v2-galleries-gallery_id-comments-count"></a>

### `GET /api/v2/galleries/{gallery_id}/comments/count` — Get Gallery Comment Count

- Desc: Get the visible comment count for a gallery.
- Auth: Public (no authentication required)
- Rate: 12/1min per IP<br>20/1min per IP
- Params: path.gallery_id!:integer
- Status: 200:Successful Response, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
0
```

<a id="delete-api-v2-comments-comment_id"></a>

### `DELETE /api/v2/comments/{comment_id}` — Delete Comment

- Desc: Delete a comment. Only the comment owner or staff can delete comments.
- Auth: User Token required
- Rate: 5/15min per user<br>5/15min per IP + user
- Params: path.comment_id!:integer
- 200: success:boolean, message:string
- Status: 200:Successful Response, 401:Unauthorized, 403:Forbidden, 404:Not Found, 422:Validation Error, 429:Too many requests, 503:Feature is currently disabled
- Response 200 shape:
```json
{
  "success": false,
  "message": "string"
}
```

<a id="post-api-v2-comments-comment_id-flag"></a>

### `POST /api/v2/comments/{comment_id}/flag` — Flag Comment

- Desc: Flag a comment for review.
- Auth: User Token required
- Rate: 10/15min per user<br>10/15min per IP + user<br>15/15min per IP
- Params: path.comment_id!:integer
- Body: {"reason":"string"}
- 200: success:boolean, message:string
- Status: 200:Successful Response, 401:Unauthorized, 404:Not Found, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "success": false,
  "message": "string"
}
```

## favorites

<a id="get-api-v2-favorites"></a>

### `GET /api/v2/favorites` — Get Favorites

- Desc: Get the authenticated user's favorite galleries.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner
- Params: query.q?:string \[def=null);enum=no], query.page?:integer[def=1;minimum: 1]
- 200: result:array, result[]:object, num_pages:integer, per_page:integer, total:integer
- Status: 200:Successful Response, 401:Unauthorized, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "result": [
    {
      "id": 0,
      "media_id": "string",
      "english_title": "string",
      "japanese_title": "string",
      "thumbnail": "string",
      "thumbnail_width": 0,
      "thumbnail_height": 0,
      "num_pages": 0,
      "num_favorites": 0,
      "tag_ids": [],
      "blacklisted": false
    }
  ],
  "num_pages": 0,
  "per_page": 0,
  "total": 0
}
```

<a id="get-api-v2-favorites-random"></a>

### `GET /api/v2/favorites/random` — Get Random Favorite

- Desc: Get a random gallery ID from the authenticated user's favorites.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner
- 200: additionalProp1:object
- Status: 200:Successful Response, 401:Unauthorized, 404:Not Found, 429:Too many requests
- Response 200 shape:
```json
{
  "additionalProp1": {}
}
```

## blacklist

<a id="get-api-v2-blacklist"></a>

### `GET /api/v2/blacklist` — Get Blacklist

- Desc: Get the authenticated user's blacklisted tags.
- Auth: User Token or API Key
- Rate: 15/1min per user<br>15/1min per API key owner
- 200: tags:array, tags[]:object, count:integer
- Status: 200:Successful Response, 401:Unauthorized, 429:Too many requests
- Response 200 shape:
```json
{
  "tags": [
    {
      "id": 0,
      "type": "string",
      "name": "string",
      "slug": "string",
      "count": 0
    }
  ],
  "count": 0
}
```

<a id="post-api-v2-blacklist"></a>

### `POST /api/v2/blacklist` — Update Blacklist

- Desc: Add or remove tags from the authenticated user's blacklist.
- Auth: User Token or API Key
- Rate: 20/15min per user<br>20/15min per API key owner
- Body: {"added":[],"removed":[]}
- 200: success:boolean, count:integer
- Status: 200:Successful Response, 400:Bad Request, 401:Unauthorized, 422:Validation Error, 429:Too many requests
- Response 200 shape:
```json
{
  "success": false,
  "count": 0
}
```

<a id="get-api-v2-blacklist-ids"></a>

### `GET /api/v2/blacklist/ids` — Get Blacklist Ids

- Desc: Get just the tag IDs for the authenticated user's blacklist.
- Auth: User Token or API Key
- Rate: 45/1min per user
- Status: 200:Successful Response, 401:Unauthorized, 429:Too many requests
- Response 200 shape:
```json
[
  0
]
```

## user

<a id="get-api-v2-user"></a>

### `GET /api/v2/user` — Get Me

- Desc: Get Me
- Auth: 未指定

