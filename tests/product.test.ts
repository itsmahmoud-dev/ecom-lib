// test("Create a product", async () => {
//   const product = await store.products.createProduct({
//     name: faker.commerce.product(),
//     barcode: faker.number.bigInt().toString(),
//     description: faker.commerce.productDescription(),
//     attributes: {
//       category: faker.word.adjective(),
//       gender: "unisex",
//     },
//     status: ProductStatus.PENDING,
//     variants: [
//       {
//         price: Number(faker.commerce.price()),
//         discount: 0,
//         attributes: {
//           color: faker.color.human(),
//           size: "XXL",
//         },
//         images: [
//           new File(
//             [
//               await Bun.file(
//                 "/home/mahmoud/Pictures/stuff from the server/image0-2.jpg",
//               ).arrayBuffer(),
//             ],
//             "image1.png",
//             { type: "image/jpg" },
//           ),
//           new File(
//             [
//               await Bun.file(
//                 "/home/mahmoud/Pictures/stuff from the server/don't simp.jpg",
//               ).arrayBuffer(),
//             ],
//             "image.png",
//             { type: "image/jpg" },
//           ),
//         ],
//       },
//     ],
//   });

//   expect(product).toBeDefined();
//   expect(product).toBeInstanceOf(Product);
//   expect(product!.variants).toBeArray();
//   product!.variants.forEach((o) => {
//     expect(o.price).toBePositive();
//   });
//   expect(
//     readdirSync(`${store.dataPath}/images/products`).length,
//   ).toBeGreaterThan(0);
// });

// test("Create a product with a duplicate barcode", async () => {
//   const testBarcode = (await store.products.repository.findOneBy({}))?.barcode;

//   const result = store.products.createProduct({
//     name: faker.commerce.product(),
//     barcode: testBarcode!,
//     description: faker.commerce.productDescription(),
//     status: ProductStatus.PENDING,
//     attributes: {
//       category: faker.word.adjective(),
//       gender: "unisex",
//     },
//     variants: [
//       {
//         price: Number(faker.commerce.price()),
//         discount: 0,
//         attributes: {
//           color: faker.color.human(),
//           size: "XXL",
//         },
//         images: [
//           new File(
//             [
//               await Bun.file(
//                 "/home/mahmoud/Pictures/stuff from the server/don't simp.jpg",
//               ).arrayBuffer(),
//             ],
//             "image.png",
//             { type: "image/jpg" },
//           ),
//         ],
//       },
//     ],
//   });

//   expect(result).rejects.toThrow(OperError);
//   expect(result).rejects.toMatchObject({
//     code: ProductErrorCodes.BarcodeAlreadyExists,
//   });
// });

// test("Update a product", async () => {
//   const [product] = await store.products.repository.find({ take: 1 });

//   expect(product).toBeInstanceOf(Product);

//   const newFields = {
//     id: product!.id,
//     name: faker.commerce.productName(),
//     barcode: faker.number.bigInt().toString(),
//     status: ProductStatus.ACTIVE,
//     description: faker.commerce.productDescription(),
//     kind: "clothing" as const,
//     attributes: {
//       gender: "unisex" as const,
//       category: "pants",
//     },
//     imagesToDelete: [product?.variants[0]?.images[0]!],
//     variants: [
//       {
//         ...product?.variants[0]!,
//         dirty: true,
//         imagesData: [
//           {
//             file: new File(
//               [
//                 await Bun.file(
//                   "/home/mahmoud/Pictures/stuff from the server/image0.jpg",
//                 ).arrayBuffer(),
//               ],
//               "image1.png",
//               { type: "image/jpg" },
//             ),
//           },
//           {
//             fileName: product?.variants[0]?.images[1]!,
//           },
//         ],
//       },
//     ],
//   };

//   const updatedProduct = await store.products.updateProduct({
//     id: newFields.id,
//     name: newFields.name,
//     barcode: newFields.barcode,
//     status: newFields.status,
//     description: newFields.description,
//     attributes: newFields.attributes,
//     variants: newFields.variants,
//     imagesToDelete: newFields.imagesToDelete,
//   });

//   expect(updatedProduct).toBeInstanceOf(Product);

//   expect(updatedProduct.name).toBe(newFields.name);
//   expect(updatedProduct.barcode).toBe(newFields.barcode);
//   expect(updatedProduct.status).toBe(newFields.status);
//   expect(updatedProduct.description).toBe(newFields.description);
//   expect(updatedProduct.attributes).toMatchObject(newFields.attributes);
//   expect(updatedProduct.variants).toHaveLength(newFields.variants.length);

//   // make sure that the original image has been deleted
//   expect(readdirSync(`${store.dataPath}/images/products/`)).not.toContain(
//     product?.variants[0]?.images[0],
//   );

//   // make sure that the new image have been added
//   expect(readdirSync(`${store.dataPath}/images/products/`)).toContain(
//     updatedProduct?.variants[0]?.images[0]!,
//   );
// });

// test("Delete product", async () => {
//   const [product] = await store.products.repository.find({ take: 1 });

//   expect(product).toBeDefined();

//   await store.products.deleteProduct(product!.id);
//   const deletedProduct = await store.products.repository.findOneBy({
//     id: product!.id,
//   });

//   expect(deletedProduct).toBeNull();
// });
