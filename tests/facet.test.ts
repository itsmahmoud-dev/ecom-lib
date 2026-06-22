// test("Add a facet", async () => {
//   const facet = await store.facets.addFacet("category", "Electronics");

//   expect(facet).toBeInstanceOf(FacetDefination);
//   expect(facet).toMatchObject({ key: "category", value: "Electronics" });
// });

// test("Add a facet with duplicate key and value", async () => {
//   const facet = store.facets.addFacet("category", "Electronics");

//   expect(facet).rejects.toThrow(OperError);
//   expect(facet).rejects.toMatchObject({
//     code: FacetErrorCodes.FacetAlreadyExists,
//   });
// });

// test("Remove a facet", async () => {
//   const facet = await store.facets.addFacet("size", "XXL");
//   await store.facets.removeFacet(facet.key, facet.value);

//   const removedFacet = await store.facets.repository.findOne({
//     where: { key: facet.key, value: facet.value },
//   });
//   expect(removedFacet).toBeNull();
// });

// test("Remove a facet that does not exist", async () => {
//   const removedFacet = store.facets.removeFacet("size", "XXL");
//   expect(removedFacet).rejects.toThrow(OperError);
//   expect(removedFacet).rejects.toMatchObject({
//     code: FacetErrorCodes.FacetNotFound,
//   });
// });
